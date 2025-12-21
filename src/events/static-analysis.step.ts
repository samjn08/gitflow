import { EventConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { StaticAnalysisResult, AuditSession, GitHubFile } from '../types/audit'
import { StaticAnalyzer } from '../utils/github'

const inputSchema = z.object({
  sessionId: z.string(),
  prDetails: z.any(),
  prFiles: z.array(z.any()),
  repository: z.object({
    owner: z.string(),
    repo: z.string()
  }),
  prNumber: z.number()
})

export const config: EventConfig = {
  type: 'event',
  name: 'StaticAnalysis',
  description: 'Performs static analysis for security vulnerabilities and code quality',
  subscribes: ['pr-data-fetched'],
  emits: [{
    topic: 'scan-complete',
    label: 'Static Analysis Complete'
  }, 'audit-progress'],
  flows: ['audit-workflow'],
  input: z.toJSONSchema(inputSchema)
}

export const handler: Handlers['StaticAnalysis'] = async (input, { emit, logger, state }) => {
  const { sessionId, prFiles } = input

  try {
    logger.info('Starting static analysis', { sessionId, filesCount: prFiles.length })

    // Update session status
    const session = await state.get('audit-sessions', sessionId) as AuditSession | null
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.currentStep = 'static-analysis'
    session.steps.push({
      stepId: 'static-analysis',
      stepName: 'Static Analysis',
      status: 'running',
      startTime: new Date().toISOString()
    })
    await state.set('audit-sessions', sessionId, session)

    // Send progress update via event emission to audit-progress stream
    await (emit as any)({
      topic: 'audit-progress',
      data: {
        type: 'scan-complete',
        sessionId,
        data: { status: 'running', stepName: 'Static Analysis' },
        timestamp: new Date().toISOString()
      }
    })

    // Perform static analysis
    const analysisResult: StaticAnalysisResult = StaticAnalyzer.analyzeDiff(prFiles as GitHubFile[])

    logger.info('Static analysis completed', {
      sessionId,
      secretsFound: analysisResult.secrets.length,
      vulnerabilitiesFound: analysisResult.vulnerabilities.length,
      securityScore: analysisResult.score
    })

    // Store analysis results
    await state.set(`analysis-${sessionId}`, 'static', analysisResult)

    // Update step status
    const currentStep = session.steps[session.steps.length - 1]
    currentStep.status = 'success'
    currentStep.endTime = new Date().toISOString()
    currentStep.data = {
      secretsFound: analysisResult.secrets.length,
      vulnerabilitiesFound: analysisResult.vulnerabilities.length,
      securityScore: analysisResult.score
    }
    await state.set('audit-sessions', sessionId, session)

    // Emit event for next step
    await (emit as any)({
      topic: 'scan-complete',
      data: {
        sessionId,
        analysisResult,
        prDetails: input.prDetails,
        prFiles: input.prFiles,
        repository: input.repository,
        prNumber: input.prNumber
      }
    })

    logger.info('Static analysis step completed', { sessionId })

  } catch (error: any) {
    logger.error('Static analysis failed', {
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
