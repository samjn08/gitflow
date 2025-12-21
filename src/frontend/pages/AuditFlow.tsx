import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'
import { AuditSession, StepExecution, AuditVerdict, AuditEvent } from '../../types/audit'
import { AuditNode } from '../components/AuditNode'
import { AnalysisDetailModal } from '../components/AnalysisDetailModal'
import { useStreamGroup } from '@motiadev/stream-client-react'

// Define node types
const nodeTypes = {
  auditNode: AuditNode,
}

// Initial nodes for the audit workflow
const initialNodes: Node[] = [
  {
    id: 'fetch-pr-data',
    type: 'auditNode',
    position: { x: 250, y: 50 },
    data: {
      label: 'Fetch PR Data',
      stepName: 'Fetch PR Data',
      status: 'idle',
      description: 'Retrieving pull request information',
    },
  },
  {
    id: 'static-analysis',
    type: 'auditNode',
    position: { x: 100, y: 270 },
    data: {
      label: 'Security Scan',
      stepName: 'Static Analysis',
      status: 'idle',
      description: 'Scanning for secrets and vulnerabilities',
    },
  },
  {
    id: 'ai-review',
    type: 'auditNode',
    position: { x: 400, y: 270 },
    data: {
      label: 'AI Code Review',
      stepName: 'AI Code Review',
      status: 'idle',
      description: 'AI-powered code quality analysis',
    },
  },
  {
    id: 'final-verdict',
    type: 'auditNode',
    position: { x: 250, y: 490 },
    data: {
      label: 'Final Verdict',
      stepName: 'Final Aggregation',
      status: 'idle',
      description: 'Authoritative audit decision',
      isFinal: true,
    },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'fetch-pr-data', target: 'static-analysis' },
  { id: 'e1-3', source: 'fetch-pr-data', target: 'ai-review' },
  { id: 'e2-4', source: 'static-analysis', target: 'final-verdict' },
  { id: 'e3-4', source: 'ai-review', target: 'final-verdict' },
]

const AuditFlow: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [session, setSession] = useState<AuditSession | null>(null)
  const [verdict, setVerdict] = useState<AuditVerdict | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  // Subscribe to audit progress stream using Motia's official React hook
  const { data: streamEvents } = useStreamGroup({
    groupId: sessionId || '',
    streamName: 'auditProgress'
  })

  const streamingConnected = streamEvents && streamEvents.length >= 0

  const handleNodeClick = useCallback((nodeData: any) => {
    // Handle final verdict differently - use existing verdict data
    if (nodeData.stepName === 'Final Aggregation') {
      setSelectedAnalysis({
        ...nodeData,
        analysisType: 'final-verdict',
        verdictData: verdict, // Pass the verdict data directly
      })
    } else {
      setSelectedAnalysis(nodeData)
    }
    setModalOpen(true)
  }, [verdict])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setSelectedAnalysis(null)
  }, [])

  // Initialize nodes with sessionId and click handler
  useEffect(() => {
    if (sessionId) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            sessionId,
            onNodeClick: handleNodeClick,
          },
        }))
      )
    }
  }, [sessionId, handleNodeClick])

  // Handle stream events using Motia's official hook
  useEffect(() => {
    if (streamEvents && streamEvents.length > 0) {
      console.log('🎯 Stream events received:', streamEvents)

      // Process the latest stream events
      streamEvents.forEach((streamItem: any) => {
        // Extract audit event data from stream item
        const event: AuditEvent = {
          type: streamItem.type,
          sessionId: streamItem.sessionId,
          data: streamItem.data,
          timestamp: streamItem.timestamp
        }

        // Only process events for this session
        if (event.sessionId !== sessionId) {
          return
        }

        console.log('📨 Processing stream event:', event)

        // Update nodes based on stream event
        updateNodesFromStreamEvent(event)

        // Handle final verdict
        if (event.type === 'audit-finalized' && event.data.verdict) {
          const rawVerdict = event.data.verdict
          const validatedVerdict: AuditVerdict = {
            verdict: (rawVerdict.verdict === 'Safe' || rawVerdict.verdict === 'Needs Changes' || rawVerdict.verdict === 'Blocked')
              ? rawVerdict.verdict
              : 'Needs Changes',
            confidence: Math.max(0, Math.min(100, Number(rawVerdict.confidence) || 0)),
            summary: String(rawVerdict.summary || 'Audit completed'),
            critical_issues: Array.isArray(rawVerdict.critical_issues)
              ? rawVerdict.critical_issues.map((issue: any) => String(issue || ''))
              : [],
            recommendations: Array.isArray(rawVerdict.recommendations)
              ? rawVerdict.recommendations.map((rec: any) => String(rec || ''))
              : [],
            timestamp: String(rawVerdict.timestamp || new Date().toISOString()),
            finalized: Boolean(rawVerdict.finalized)
          }
          setVerdict(validatedVerdict)
          console.log('🎉 Verdict received via stream:', validatedVerdict)
        }
      })
    }
  }, [streamEvents, sessionId])

  // Poll for session updates (keeps running as fallback for streaming)
  useEffect(() => {
    if (sessionId) {
      const pollSession = async () => {
        try {
          const response = await axios.get(`/api/audit/session/${sessionId}`)
          const sessionData: AuditSession = response.data
          setSession(sessionData)

          // Update node statuses based on session steps
          updateNodesFromSession(sessionData)

          // Check if audit is complete
          if (sessionData.status === 'completed' && sessionData.steps.some(s => s.stepName === 'Final Aggregation' && s.status === 'success')) {
            // Get verdict from final aggregation step data
            const finalStep = sessionData.steps.find(s => s.stepName === 'Final Aggregation')
            if (finalStep?.data?.verdict) {
              // Validate verdict data structure
              const rawVerdict = finalStep.data.verdict
              const validatedVerdict: AuditVerdict = {
                verdict: (rawVerdict.verdict === 'Safe' || rawVerdict.verdict === 'Needs Changes' || rawVerdict.verdict === 'Blocked')
                  ? rawVerdict.verdict
                  : 'Needs Changes', // Default fallback
                confidence: Math.max(0, Math.min(100, Number(rawVerdict.confidence) || 0)),
                summary: String(rawVerdict.summary || 'Audit completed'),
                critical_issues: Array.isArray(rawVerdict.critical_issues)
                  ? rawVerdict.critical_issues.map((issue: any) => String(issue || ''))
                  : [],
                recommendations: Array.isArray(rawVerdict.recommendations)
                  ? rawVerdict.recommendations.map((rec: any) => String(rec || ''))
                  : [],
                timestamp: String(rawVerdict.timestamp || new Date().toISOString()),
                finalized: Boolean(rawVerdict.finalized)
              }
              setVerdict(validatedVerdict)
              console.log('Verdict received and validated:', validatedVerdict)
            } else {
              console.log('No verdict data found in final step')
            }
          }

          // Stop polling if session is completed or failed
          if (sessionData.status === 'completed' || sessionData.status === 'failed') {
            if (pollingInterval) {
              clearInterval(pollingInterval)
              setPollingInterval(null)
            }
          }
        } catch (error) {
          console.error('Failed to poll session:', error)
        }
      }

      // Initial poll
      pollSession()

      // Set up polling every 2 seconds
      const interval = setInterval(pollSession, 2000)
      setPollingInterval(interval)

      return () => {
        if (interval) {
          clearInterval(interval)
        }
      }
    }
  }, [sessionId])

  const updateNodesFromSession = useCallback((sessionData: AuditSession) => {
    setNodes((nds) =>
      nds.map((node) => {
        // Map step names to node IDs
        const stepNameToNodeId: Record<string, string> = {
          'Fetch PR Data': 'fetch-pr-data',
          'Static Analysis': 'static-analysis',
          'AI Code Review': 'ai-review',
          'Final Aggregation': 'final-verdict',
        }

        const nodeId = stepNameToNodeId[node.data.stepName]
        if (node.id === nodeId) {
          const step = sessionData.steps.find(s => s.stepName === node.data.stepName)
          return {
            ...node,
            data: {
              ...node.data,
              status: step?.status || 'idle',
              data: step?.data ? {
                ...step.data,
                // Extract just the verdict string, not the entire verdict object
                verdict: typeof step.data.verdict === 'object' && step.data.verdict?.verdict
                  ? step.data.verdict.verdict
                  : step.data.verdict,
              } : undefined,
            },
          }
        }
        return node
      })
    )
  }, [])

  const updateNodesFromStreamEvent = useCallback((event: AuditEvent) => {
    // Map event types to step names and statuses
    const eventTypeToStepInfo: Record<string, { stepName: string; status: string }> = {
      'pr-data-fetched': { stepName: 'Fetch PR Data', status: 'running' },
      'scan-complete': { stepName: 'Static Analysis', status: 'running' },
      'ai-review-complete': { stepName: 'AI Code Review', status: 'running' },
      'audit-finalized': { stepName: 'Final Aggregation', status: 'success' },
    }

    const stepInfo = eventTypeToStepInfo[event.type]
    if (!stepInfo) {
      console.warn('Unknown event type for node update:', event.type)
      return
    }

    setNodes((nds) =>
      nds.map((node) => {
        if (node.data.stepName === stepInfo.stepName) {
          return {
            ...node,
            data: {
              ...node.data,
              status: stepInfo.status,
              data: event.data,
            },
          }
        }
        return node
      })
    )

    // Update session state for progress tracking
    setSession(prevSession => {
      if (!prevSession) return prevSession

      const updatedSteps = prevSession.steps.map(step => {
        if (step.stepName === stepInfo.stepName) {
          return {
            ...step,
            status: stepInfo.status as any,
            endTime: stepInfo.status === 'success' ? new Date().toISOString() : step.endTime,
            data: event.data
          }
        }
        return step
      })

      return {
        ...prevSession,
        steps: updatedSteps,
        status: event.type === 'audit-finalized' ? 'completed' : prevSession.status,
        updatedAt: new Date().toISOString()
      }
    })
  }, [])



  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  return (
    <div className="h-screen w-full bg-gradient-to-br from-background via-background-secondary to-background relative overflow-hidden">
      {/* Background decorations - optimized for performance */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-primary-light)_0%,transparent_70%)] opacity-5"></div>
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-secondary/3 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl"></div>

      <div className="relative z-10 h-screen w-full">
        {/* Header */}
        <div className="glass border-b border-border-light p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary-light rounded-lg flex items-center justify-center">
                  <span className="text-background font-bold text-lg">AI</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                    GitFlow AI Audit
                  </h1>
                  <div className="flex items-center space-x-3">
                    <p className="text-xs text-foreground-tertiary">
                      Session ID: <code className="bg-background-secondary px-2 py-1 rounded text-xs">{sessionId}</code>
                    </p>
                    {/* Streaming Status Indicator */}
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                      streamingConnected
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-warning/10 text-warning border border-warning/20'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        streamingConnected ? 'bg-success animate-pulse' : 'bg-warning'
                      }`}></div>
                      <span>{streamingConnected ? 'Live' : 'Polling'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center space-x-4">
              {session && (
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    session.status === 'completed' ? 'text-success' :
                    session.status === 'failed' ? 'text-error' :
                    'text-primary'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </div>
                  <div className="text-xs text-foreground-tertiary">
                    {session.steps.filter(s => s.status === 'success').length} / {session.steps.length} steps completed
                  </div>
                </div>
              )}

              {/* Verdict Badge */}
              {verdict && (
                <div className={`px-4 py-2 rounded-full text-sm font-semibold animate-bounce-in ${
                  verdict.verdict === 'Safe' ? 'bg-success text-background shadow-lg shadow-success/25' :
                  verdict.verdict === 'Needs Changes' ? 'bg-warning text-background shadow-lg shadow-warning/25' :
                  'bg-error text-background shadow-lg shadow-error/25'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span>
                      {verdict.verdict === 'Safe' ? '✅' :
                       verdict.verdict === 'Needs Changes' ? '⚠️' : '🚫'}
                    </span>
                    <span>{verdict.verdict}</span>
                    <span className="text-xs opacity-90">({verdict.confidence}%)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {session && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-foreground-tertiary mb-2">
                <span>Audit Progress</span>
                <span>{Math.round((session.steps.filter(s => s.status === 'success').length / session.steps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-primary to-primary-light h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(session.steps.filter(s => s.status === 'success').length / session.steps.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* React Flow Container */}
        <div className="h-[calc(100vh-200px)] relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          >
            <Controls className="bg-background-secondary/80 backdrop-blur-sm border border-border rounded-lg" />
            <MiniMap
              className="bg-background-secondary/90 backdrop-blur-sm border border-border"
              nodeColor={(node) => {
                switch (node.data?.status) {
                  case 'running': return 'var(--color-primary)'
                  case 'success': return 'var(--color-success)'
                  case 'failed': return 'var(--color-error)'
                  default: return 'var(--color-border-secondary)'
                }
              }}
              maskColor="rgba(0, 0, 0, 0.2)"
            />
            <Background
              color="var(--color-border-light)"
              gap={30}
              size={1}
              className="opacity-20"
            />
          </ReactFlow>
        </div>

        {/* Analysis Detail Modal */}
        {modalOpen && (
          <AnalysisDetailModal
            isOpen={modalOpen}
            onClose={closeModal}
            analysisData={selectedAnalysis}
          />
        )}
      </div>
    </div>
  )
}

export default AuditFlow
