import { ApiRouteConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { AuditSessionSchema } from '../types/audit'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetSession',
  description: 'Retrieves audit session status and progress',
  path: '/audit/session/:sessionId',
  method: 'GET',
  emits: [],
  flows: ['audit-workflow'],
  responseSchema: {
    200: AuditSessionSchema,
    404: z.object({
      error: z.string()
    })
  }
}

export const handler: Handlers['GetSession'] = async (req, { state, logger }) => {
  const { sessionId } = req.pathParams

  try {
    logger.info('Retrieving session status', { sessionId })

    const session = await state.get('audit-sessions', sessionId)
    if (!session) {
      return {
        status: 404,
        body: { error: 'Session not found' }
      }
    }

    logger.info('Session retrieved', { sessionId, status: session.status })

    return {
      status: 200,
      body: session
    }

  } catch (error: any) {
    logger.error('Session retrieval failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    })
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}
