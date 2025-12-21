import { ApiRouteConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { AuditConfigSchema } from '../types/audit'
import { GitHubAPI } from '../utils/github'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'StartAudit',
  description: 'Initiates a new audit session for a GitHub repository',
  path: '/audit/start',
  method: 'POST',
  emits: ['audit-started'],
  flows: ['audit-workflow'],
  bodySchema: AuditConfigSchema,
  responseSchema: {
    200: z.object({
      sessionId: z.string(),
      message: z.string(),
      prCount: z.number()
    }),
    400: z.object({
      error: z.string()
    }),
    500: z.object({
      error: z.string()
    })
  }
}

export const handler: Handlers['StartAudit'] = async (req, { emit, logger, state }) => {
  try {
    const config = req.body

    // Validate GitHub repository URL
    const repoInfo = GitHubAPI.parseRepoUrl(config.repositoryUrl)
    if (!repoInfo) {
      return {
        status: 400,
        body: { error: 'Invalid GitHub repository URL' }
      }
    }

    const { owner, repo } = repoInfo
    logger.info('Starting audit for repository', { owner, repo })

    // Initialize GitHub API client
    const github = new GitHubAPI()

    // Get repository information and open PRs
    let prCount = 0
    let targetPR = config.prNumber

    try {
      const repository = await github.getRepository(owner, repo)
      logger.info('Repository found', { name: repository.name, private: repository.private })

      const openPRs = await github.getOpenPullRequests(owner, repo)
      prCount = openPRs.length

      // If no specific PR number provided, use the most recent open PR
      if (!targetPR && openPRs.length > 0) {
        targetPR = openPRs[0].number
        logger.info('Using most recent PR', { prNumber: targetPR })
      }

      if (!targetPR) {
        return {
          status: 400,
          body: { error: 'No open pull requests found in the repository' }
        }
      }

      // Get PR details
      const pr = await github.getPullRequest(owner, repo, targetPR)
      logger.info('PR details retrieved', { title: pr.title, state: pr.state })

      if (pr.state !== 'open') {
        return {
          status: 400,
          body: { error: 'Pull request is not open' }
        }
      }

    } catch (error: any) {
      logger.error('GitHub API error', { error: error.message })
      return {
        status: 400,
        body: { error: `GitHub API error: ${error.message}` }
      }
    }

    // Create audit session
    const sessionId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const session = {
      id: sessionId,
      config: {
        ...config,
        prNumber: targetPR
      },
      status: 'initializing',
      steps: [],
      currentStep: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Store session in state
    await state.set('audit-sessions', sessionId, session)

    // Emit audit-started event
    await emit({
      topic: 'audit-started',
      data: {
        sessionId,
        config: session.config,
        repository: { owner, repo },
        prNumber: targetPR
      }
    })

    logger.info('Audit session created', { sessionId, prNumber: targetPR })

    return {
      status: 200,
      body: {
        sessionId,
        message: 'Audit session started successfully',
        prCount
      }
    }

  } catch (error: any) {
    logger.error('Audit start failed', { error: error.message, stack: error.stack })
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}
