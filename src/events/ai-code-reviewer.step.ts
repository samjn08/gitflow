import { EventConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { AIReviewResult, AuditSession, GitHubFile } from '../types/audit'
import { OpenRouterAPI } from '../utils/openrouter'

export const config: EventConfig = {
  type: 'event',
  name: 'AICodeReviewer',
  description: 'Uses AI to perform comprehensive code review and quality analysis',
  subscribes: ['scan-complete'],
  emits: ['ai-review-complete', 'audit-progress'],
  flows: ['audit-workflow']
}

export const handler: Handlers['AICodeReviewer'] = async (input: any, { emit, logger, state }) => {
  const { sessionId, prDetails, prFiles } = input

  console.log('AI Code Review Input:', {
    sessionId,
    prFilesCount: prFiles?.length || 0,
    prFiles: prFiles?.slice(0, 2), // Log first 2 files for debugging
    prDetails: prDetails ? { title: prDetails.title, body: prDetails?.body ? prDetails.body.substring(0, 100) : null } : null
  })

  try {
    logger.info('Starting AI code review', { sessionId, filesCount: prFiles.length })

    // Update session status
    const session = await state.get('audit-sessions', sessionId) as AuditSession | null
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.currentStep = 'ai-review'
    session.steps.push({
      stepId: 'ai-review',
      stepName: 'AI Code Review',
      status: 'running',
      startTime: new Date().toISOString()
    })
    await state.set('audit-sessions', sessionId, session)

    // Send progress update via event emission to audit-progress stream
    await (emit as any)({
      topic: 'audit-progress',
      data: {
        type: 'ai-review-complete',
        sessionId,
        data: { status: 'running', stepName: 'AI Code Review' },
        timestamp: new Date().toISOString()
      }
    })

    // Initialize OpenRouter API
    const openRouter = new OpenRouterAPI(session.config.openRouterKey)

    // Perform AI code review using OpenRouter
    const aiReview: AIReviewResult = await openRouter.reviewCode(
      prFiles,
      prDetails.title,
      prDetails.body || 'No description provided'
    )

    logger.info('AI code review completed', {
      sessionId,
      overallScore: aiReview.overall_score,
      criticalIssues: aiReview.critical_issues.length
    })

    // Store AI review results
    await state.set(`analysis-${sessionId}`, 'ai-review', aiReview)

    // Update step status
    const currentStep = session.steps[session.steps.length - 1]
    currentStep.status = 'success'
    currentStep.endTime = new Date().toISOString()
    currentStep.data = {
      overallScore: aiReview.overall_score,
      criticalIssues: aiReview.critical_issues.length,
      categories: Object.keys(aiReview.categories).length
    }
    await state.set('audit-sessions', sessionId, session)

    // Emit event for next step
    await emit({
      topic: 'ai-review-complete',
      data: {
        sessionId,
        aiReview,
        ...input
      }
    })

    logger.info('AI code review step completed', { sessionId })

  } catch (error: any) {
    logger.error('AI code review failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    })

    // Update session with error
    try {
      const session = await state.get('audit-sessions', sessionId) as AuditSession | null
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
