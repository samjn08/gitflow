import { StreamConfig } from '@motiadev/core'

export const config: StreamConfig = {
  name: 'auditProgress',
  schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['audit-started', 'pr-data-fetched', 'scan-complete', 'ai-review-complete', 'dependency-risk-found', 'audit-finalized']
      },
      sessionId: { type: 'string' },
      data: {
        type: 'object',
        additionalProperties: true
      },
      timestamp: { type: 'string' }
    },
    required: ['type', 'sessionId', 'data', 'timestamp']
  },
  baseConfig: { storageType: 'default' },
  canAccess: () => {
    // For now, allow all connections - in production you'd want authentication
    return true
  }
}

// This stream will be populated by the Motia steps as they progress
// The frontend will subscribe to this stream to get real-time updates
