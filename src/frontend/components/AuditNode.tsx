import React from 'react'
import { Handle, Position } from 'reactflow'

interface AuditNodeProps {
  data: {
    label: string
    stepName: string
    status: 'idle' | 'running' | 'success' | 'failed'
    description: string
    data?: any
    isFinal?: boolean
    onNodeClick?: (nodeData: any) => void
    sessionId?: string
  }
}

export const AuditNode: React.FC<AuditNodeProps> = ({ data }) => {
  const { label, stepName, status, description, data: nodeData, isFinal, onNodeClick, sessionId } = data

  // Check if this node is expandable (security scan, AI review, or final verdict)
  const isExpandable = stepName === 'Static Analysis' || stepName === 'AI Code Review' || stepName === 'Final Aggregation'

  const handleClick = () => {
    if (isExpandable && onNodeClick && sessionId) {
      onNodeClick({
        stepName,
        sessionId,
        analysisType: stepName === 'Static Analysis' ? 'static' :
                     stepName === 'AI Code Review' ? 'ai-review' : 'final-verdict',
        label,
        status,
        data: nodeData,
      })
    }
  }

  const getStatusColor = () => {
    // Special handling for final verdict nodes - color based on verdict
    if (isFinal && nodeData?.verdict) {
      switch (nodeData.verdict) {
        case 'Safe':
          return 'border-success bg-success/10'
        case 'Needs Changes':
          return 'border-warning bg-warning/10'
        case 'Blocked':
          return 'border-error bg-error/10'
        default:
          return 'border-border bg-background-secondary'
      }
    }

    // Regular status-based coloring for other nodes
    switch (status) {
      case 'running':
        return 'border-primary bg-primary/10'
      case 'success':
        return 'border-success bg-success/10'
      case 'failed':
        return 'border-error bg-error/10'
      default:
        return 'border-border bg-background-secondary'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return (
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        )
      case 'success':
        return (
          <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-4 h-4 text-error" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-foreground-secondary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  return (
    <div
      className={`px-5 py-4 glass-card border-2 min-w-[240px] max-w-[320px] transition-all duration-300 hover-lift ${
        getStatusColor()
      } ${isExpandable ? 'cursor-pointer' : ''} animate-fade-in`}
      onClick={handleClick}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 !bg-background-secondary !border-2 !border-primary rounded-full shadow-sm"
      />

      {/* Header */}
      <div className="flex items-center space-x-3 mb-3">
        <div className="flex-shrink-0 relative">
          <div className={`p-2 rounded-lg ${
            status === 'running' ? 'bg-primary/20' :
            status === 'success' ? 'bg-success/20' :
            status === 'failed' ? 'bg-error/20' :
            'bg-border/20'
          }`}>
            {getStatusIcon()}
          </div>
          {status === 'running' && (
            <div className="absolute -inset-1 bg-primary/20 rounded-lg animate-pulse"></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">
            {label}
          </h3>
          <p className="text-xs text-foreground-tertiary truncate flex items-center gap-1">
            {stepName}
            {isExpandable && (
              <span className="text-primary text-xs">🔍</span>
            )}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground-secondary mb-4 leading-relaxed">
        {description}
      </p>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`badge-modern ${
          status === 'running' ? 'badge-primary' :
          status === 'success' ? 'badge-success' :
          status === 'failed' ? 'badge-error' :
          'bg-border-secondary text-foreground-tertiary'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>

        {isFinal && nodeData && (
          <div className="text-right">
            <div className={`text-sm font-bold ${
              nodeData.verdict === 'Safe' ? 'text-success' :
              nodeData.verdict === 'Needs Changes' ? 'text-warning' :
              'text-error'
            }`}>
              {nodeData.verdict === 'Safe' ? '✅' :
               nodeData.verdict === 'Needs Changes' ? '⚠️' : '🚫'}
            </div>
            {nodeData.confidence && (
              <div className="text-xs text-foreground-tertiary">
                {nodeData.confidence}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Data or Verdict Details */}
      {nodeData && (
        <div className="pt-3 border-t border-border-light/50">
          {isFinal ? (
            /* Final Verdict Details */
            <div className="space-y-3">
              {/* Verdict Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-tertiary">Verdict:</span>
                <span className={`font-bold text-sm ${
                  nodeData.verdict === 'Safe' ? 'text-success' :
                  nodeData.verdict === 'Needs Changes' ? 'text-warning' :
                  'text-error'
                }`}>
                  {nodeData.verdict === 'Safe' ? '✅ SAFE' :
                   nodeData.verdict === 'Needs Changes' ? '⚠️ NEEDS CHANGES' :
                   '🚫 BLOCKED'}
                </span>
              </div>

              {/* Confidence */}
              {nodeData.confidence && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-tertiary">Confidence:</span>
                  <span className="font-semibold text-primary text-sm">{nodeData.confidence}%</span>
                </div>
              )}

              {/* Critical Issues Count */}
              {nodeData.critical_issues && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-tertiary">Critical Issues:</span>
                  <span className={`font-semibold text-sm ${
                    nodeData.critical_issues.length > 0 ? 'text-error' : 'text-success'
                  }`}>
                    {nodeData.critical_issues.length}
                  </span>
                </div>
              )}

              {/* Mini Summary */}
              {nodeData.summary && (
                <div className="mt-3 pt-3 border-t border-border-light/30">
                  <p className="text-xs text-foreground-secondary leading-relaxed line-clamp-2">
                    {nodeData.summary.length > 80
                      ? `${nodeData.summary.substring(0, 80)}...`
                      : nodeData.summary
                    }
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Regular Progress Data for other nodes */
            <div className="space-y-2">
              {nodeData.filesCount && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-tertiary">Files:</span>
                  <span className="font-semibold text-foreground">{nodeData.filesCount}</span>
                </div>
              )}
              {nodeData.secretsFound !== undefined && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-tertiary">Secrets:</span>
                  <span className={`font-semibold ${nodeData.secretsFound > 0 ? 'text-error' : 'text-success'}`}>
                    {nodeData.secretsFound}
                  </span>
                </div>
              )}
              {nodeData.overallScore !== undefined && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-tertiary">Score:</span>
                  <span className={`font-semibold ${
                    nodeData.overallScore >= 80 ? 'text-success' :
                    nodeData.overallScore >= 60 ? 'text-warning' :
                    'text-error'
                  }`}>
                    {nodeData.overallScore}%
                  </span>
                </div>
              )}
              {nodeData.verdict && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground-tertiary">Verdict:</span>
                  <span className={`font-bold ${
                    nodeData.verdict === 'Safe' ? 'text-success' :
                    nodeData.verdict === 'Needs Changes' ? 'text-warning' :
                    'text-error'
                  }`}>
                    {nodeData.verdict === 'Safe' ? '✅' :
                     nodeData.verdict === 'Needs Changes' ? '⚠️' : '🚫'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 !bg-background-secondary !border-2 !border-primary rounded-full shadow-sm"
      />
    </div>
  )
}
