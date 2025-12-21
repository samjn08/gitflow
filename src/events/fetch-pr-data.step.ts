import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { GitHubAPI } from '../utils/github'
import { AuditEvent, AuditSession } from '../types/audit'

const inputSchema = {
  type: 'object' as const,
  properties: {
    sessionId: { type: 'string' as const },
    config: {
      type: 'object' as const,
      properties: {
        repositoryUrl: { type: 'string' as const },
        prNumber: { type: 'number' as const }
      },
      required: ['repositoryUrl', 'prNumber']
    },
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
  required: ['sessionId', 'config', 'repository', 'prNumber']
}

export const config: EventConfig = {
  type: 'event',
  name: 'FetchPRData',
  description: 'Fetches pull request data and files from GitHub',
  subscribes: ['audit-started'],
  emits: ['pr-data-fetched'],
  flows: ['audit-workflow'],
  input: inputSchema
}

export const handler: Handlers['FetchPRData'] = async (input, { emit, logger, state, streams }) => {
  const { sessionId, config, repository, prNumber } = input
  const { owner, repo } = repository

  try {
    logger.info('Fetching PR data', { sessionId, owner, repo, prNumber })

    // Update session status
    const sessionData = await state.get('audit-sessions', sessionId) as AuditSession | null
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const session: AuditSession = {
      ...sessionData,
      status: 'running',
      currentStep: 'fetch-pr-data',
      steps: [...sessionData.steps, {
        stepId: 'fetch-pr-data',
        stepName: 'Fetch PR Data',
        status: 'running',
        startTime: new Date().toISOString()
      }]
    }
    await state.set('audit-sessions', sessionId, session)

    // Send progress update to audit-progress stream
    await streams.auditProgress.set(sessionId, 'pr-data-fetched', {
      type: 'pr-data-fetched',
      sessionId,
      data: { status: 'running', stepName: 'Fetch PR Data' },
      timestamp: new Date().toISOString()
    })

    // Initialize GitHub API
    const github = new GitHubAPI()

    // Fetch PR details and files
    const [prDetails, prFiles] = await Promise.all([
      github.getPullRequest(owner, repo, prNumber),
      github.getPullRequestFiles(owner, repo, prNumber)
    ])

    logger.info('PR data retrieved', {
      title: prDetails.title,
      files: prFiles.length,
      additions: prFiles.reduce((sum, f) => sum + f.additions, 0),
      deletions: prFiles.reduce((sum, f) => sum + f.deletions, 0)
    })

    // Store PR data in state
    await state.set(`pr-data-${sessionId}`, 'details', prDetails)
    await state.set(`pr-data-${sessionId}`, 'files', prFiles)

    // Update step status
    const currentStep = session.steps[session.steps.length - 1]
    currentStep.status = 'success'
    currentStep.endTime = new Date().toISOString()
    currentStep.data = {
      filesCount: prFiles.length,
      totalAdditions: prFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: prFiles.reduce((sum, f) => sum + f.deletions, 0)
    }
    await state.set('audit-sessions', sessionId, session)

    // Emit event for next step
    await emit({
      topic: 'pr-data-fetched',
      data: {
        sessionId,
        prDetails,
        prFiles,
        repository: { owner, repo },
        prNumber
      }
    })

    logger.info('PR data fetch completed', { sessionId })

  } catch (error: any) {
    logger.error('PR data fetch failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    })

    // Update session with error
    try {
      const sessionData = await state.get('audit-sessions', sessionId) as AuditSession | null
      if (sessionData) {
        const session: AuditSession = {
          ...sessionData,
          status: 'failed',
          steps: sessionData.steps.map(step =>
            step.stepId === 'fetch-pr-data'
              ? { ...step, status: 'failed', endTime: new Date().toISOString(), error: error.message }
              : step
          )
        }
        await state.set('audit-sessions', sessionId, session)
      }
    } catch (stateError: any) {
      logger.error('Failed to update session state', { stateError: stateError.message })
    }

    throw error
  }
}
