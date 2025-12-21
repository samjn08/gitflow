import { EventConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { AuditVerdict, AuditSession } from '../types/audit'

const inputSchema = {
  type: 'object' as const,
  properties: {
    sessionId: { type: 'string' as const },
    aiReview: { type: 'object' as const },
    analysisResult: { type: 'object' as const },
    prDetails: { type: 'object' as const },
    prFiles: { type: 'array' as const, items: { type: 'object' as const } },
    repository: {
      type: 'object' as const,
      properties: {
        owner: { type: 'string' as const },
        repo: { type: 'string' as const }
      },
      required: ['owner', 'repo']
    },
    prNumber: { type: 'number' as const }
  },
  required: ['sessionId', 'aiReview', 'analysisResult', 'prDetails', 'prFiles', 'repository', 'prNumber']
}

export const config: EventConfig = {
  type: 'event',
  name: 'FinalAggregation',
  description: 'Combines all audit results and produces final verdict',
  subscribes: ['ai-review-complete', 'dependency-risk-found'],
  emits: ['audit-finalized', 'audit-progress'],
  flows: ['audit-workflow'],
  input: inputSchema
}

export const handler: Handlers['FinalAggregation'] = async (input, { emit, logger, state, streams }) => {
  const { sessionId } = input

  try {
    logger.info('Starting final aggregation', { sessionId })

    // Update session status
    const session = await state.get('audit-sessions', sessionId) as AuditSession
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.currentStep = 'final-aggregation'
    session.steps.push({
      stepId: 'final-aggregation',
      stepName: 'Final Aggregation',
      status: 'running',
      startTime: new Date().toISOString()
    })
    await state.set('audit-sessions', sessionId, session)

    // Send progress update via event emission to audit-progress stream
    await (emit as any)({
      topic: 'audit-progress',
      data: {
        type: 'audit-finalized',
        sessionId,
        data: { status: 'running', stepName: 'Final Aggregation' },
        timestamp: new Date().toISOString()
      }
    })

    // Retrieve all analysis results
    const [staticAnalysis, aiReview] = await Promise.all([
      state.get(`analysis-${sessionId}`, 'static'),
      state.get(`analysis-${sessionId}`, 'ai-review')
    ])

    if (!staticAnalysis || !aiReview) {
      throw new Error('Missing analysis results')
    }

    // Calculate final verdict based on all results
    const verdict = calculateFinalVerdict(staticAnalysis, aiReview)

    logger.info('Final verdict calculated', {
      sessionId,
      verdict: verdict.verdict,
      confidence: verdict.confidence
    })

    // Store final verdict
    await state.set(`analysis-${sessionId}`, 'final-verdict', verdict)

    // Update session as completed
    session.status = 'completed'
    session.updatedAt = new Date().toISOString()

    // Update final step status
    const currentStep = session.steps[session.steps.length - 1]
    currentStep.status = 'success'
    currentStep.endTime = new Date().toISOString()
    currentStep.data = {
      verdict: verdict  // Store the complete verdict object
    }
    await state.set('audit-sessions', sessionId, session)

    // Send final result via event emission to audit-progress stream
    await (emit as any)({
      topic: 'audit-progress',
      data: {
        type: 'audit-finalized',
        sessionId,
        data: {
          verdict,
          staticAnalysis,
          ...input
        },
        timestamp: new Date().toISOString()
      }
    })

    logger.info('Final aggregation completed', { sessionId, verdict: verdict.verdict })

  } catch (error: any) {
    logger.error('Final aggregation failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    })

    // Update session with error
    try {
      const session = await state.get('audit-sessions', sessionId) as AuditSession
      if (session) {
        session.status = 'failed'
        const currentStep = session.steps[session.steps.length - 1]
        currentStep.status = 'failed'
        currentStep.endTime = new Date().toISOString()
        currentStep.error = error.message
        await state.set('audit-sessions', sessionId, session)
      }
    } catch (stateError: any) {
      logger.error('Failed to update session state', { stateError: stateError.message })
    }

    throw error
  }
}

function calculateFinalVerdict(staticAnalysis: any, aiReview: any): AuditVerdict {
  const criticalIssues: string[] = []
  const recommendations: string[] = []
  let totalScore = 0
  let scoreCount = 0

  // Static analysis scoring
  const staticScore = staticAnalysis.score
  totalScore += staticScore
  scoreCount++

  if (staticAnalysis.secrets.length > 0) {
    criticalIssues.push(`Found ${staticAnalysis.secrets.length} potential secret leaks`)
  }

  if (staticAnalysis.vulnerabilities.length > 0) {
    const criticalVulns = staticAnalysis.vulnerabilities.filter((v: any) => v.severity === 'critical').length
    const highVulns = staticAnalysis.vulnerabilities.filter((v: any) => v.severity === 'high').length

    if (criticalVulns > 0) {
      criticalIssues.push(`Found ${criticalVulns} critical security vulnerabilities`)
    }
    if (highVulns > 0) {
      criticalIssues.push(`Found ${highVulns} high-severity security vulnerabilities`)
    }
  }

  // AI review scoring
  const aiScore = aiReview.overall_score
  totalScore += aiScore
  scoreCount++

  // Add AI critical issues
  criticalIssues.push(...aiReview.critical_issues)

  // Add AI recommendations
  Object.values(aiReview.categories).forEach((category: any) => {
    recommendations.push(...category.suggestions)
  })

  // Calculate final verdict
  const averageScore = totalScore / scoreCount

  let verdict: 'Safe' | 'Needs Changes' | 'Blocked'
  let confidence = Math.min(100, Math.max(0, averageScore))

  if (criticalIssues.length > 0 || averageScore < 40) {
    verdict = 'Blocked'
  } else if (averageScore < 70) {
    verdict = 'Needs Changes'
  } else {
    verdict = 'Safe'
  }

  // Generate summary
  const summary = generateSummary(verdict, averageScore, criticalIssues.length)

  return {
    verdict,
    confidence: Math.round(confidence),
    summary,
    critical_issues: criticalIssues,
    recommendations: recommendations.slice(0, 10), // Limit to top 10
    timestamp: new Date().toISOString(),
    finalized: true
  }
}

function generateSummary(verdict: string, score: number, criticalCount: number): string {
  const roundedScore = Math.round(score)

  switch (verdict) {
    case 'Safe':
      return `Audit passed with ${roundedScore}% score. Code meets quality standards.`

    case 'Needs Changes':
      return `Audit requires changes (${roundedScore}% score). Address the identified issues before merging.`

    case 'Blocked':
      return `Audit blocked (${roundedScore}% score). ${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} must be resolved.`

    default:
      return `Audit completed with ${roundedScore}% score.`
  }
}
