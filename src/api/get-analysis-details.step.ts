import { ApiRouteConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { AuditSession, StaticAnalysisResult, AIReviewResult } from '../types/audit'

const inputSchema = z.object({
  sessionId: z.string(),
  analysisType: z.enum(['static', 'ai-review']),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetAnalysisDetails',
  description: 'Retrieves detailed analysis results for security scans and AI code reviews',
  path: '/audit/analysis/:sessionId/:analysisType',
  method: 'GET',
  emits: [],
  flows: ['audit-workflow'],
  responseSchema: {
    200: z.object({
      analysisType: z.string(),
      data: z.any(),
      sessionId: z.string(),
      timestamp: z.string(),
    }),
    404: z.object({
      error: z.string(),
      message: z.string(),
    }),
    500: z.object({
      error: z.string(),
      message: z.string(),
    }),
  },
}

export const handler: Handlers['GetAnalysisDetails'] = async (req, { state, logger }) => {
  const { sessionId, analysisType } = req.pathParams as { sessionId: string; analysisType: string }

  try {
    logger.info('Fetching analysis details', { sessionId, analysisType })

    // Verify session exists
    const session: AuditSession = await state.get('audit-sessions', sessionId)
    if (!session) {
      logger.warn('Session not found', { sessionId })
      return {
        status: 404,
        body: {
          error: 'Session not found',
          message: `Audit session ${sessionId} does not exist`,
        },
      }
    }

    // Fetch detailed analysis data
    const analysisKey = `analysis-${sessionId}`
    const analysisData = await state.get(analysisKey, analysisType)

    if (!analysisData) {
      logger.warn('Analysis data not found', { sessionId, analysisType })
      return {
        status: 404,
        body: {
          error: 'Analysis data not found',
          message: `No ${analysisType} analysis data available for session ${sessionId}`,
        },
      }
    }

    logger.info('Analysis details retrieved successfully', {
      sessionId,
      analysisType,
      hasData: !!analysisData,
    })

    return {
      status: 200,
      body: {
        analysisType,
        data: analysisData,
        sessionId,
        timestamp: new Date().toISOString(),
      },
    }

  } catch (error: any) {
    logger.error('Failed to fetch analysis details', {
      sessionId,
      analysisType,
      error: error.message,
      stack: error.stack,
    })

    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to retrieve analysis details',
      },
    }
  }
}
