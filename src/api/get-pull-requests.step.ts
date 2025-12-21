import { ApiRouteConfig, Handlers } from '@motiadev/core'
import { z } from 'zod'
import { GitHubAPI } from '../utils/github'

const repoUrlSchema = z.object({
  repositoryUrl: z.string().url(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetPullRequests',
  description: 'Fetches open pull requests for a GitHub repository',
  path: '/pull-requests',
  method: 'GET',
  emits: [],
  flows: ['audit-workflow'],
  queryParams: [
    {
      name: 'repositoryUrl',
      description: 'GitHub repository URL to fetch PRs from'
    }
  ],
  responseSchema: {
    200: z.object({
      pullRequests: z.array(z.object({
        number: z.number(),
        title: z.string(),
        html_url: z.string(),
        user: z.object({
          login: z.string(),
          avatar_url: z.string(),
        }),
        created_at: z.string(),
        updated_at: z.string(),
      })),
      totalCount: z.number()
    }),
    400: z.object({
      error: z.string()
    }),
    500: z.object({
      error: z.string()
    })
  }
}

export const handler: Handlers['GetPullRequests'] = async (req, { logger }) => {
  try {
    const { repositoryUrl } = req.queryParams

    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
      return {
        status: 400,
        body: { error: 'Repository URL is required' }
      }
    }

    // Validate GitHub repository URL
    const repoInfo = GitHubAPI.parseRepoUrl(repositoryUrl)
    if (!repoInfo) {
      return {
        status: 400,
        body: { error: 'Invalid GitHub repository URL' }
      }
    }

    const { owner, repo } = repoInfo
    logger.info('Fetching PRs for repository', { owner, repo })

    // Initialize GitHub API client
    const github = new GitHubAPI()

    try {
      // Get open pull requests
      const openPRs = await github.getOpenPullRequests(owner, repo)
      logger.info('PRs fetched successfully', { count: openPRs.length })

      // Format PRs for frontend consumption
      const formattedPRs = openPRs.map(pr => ({
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url,
        },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      }))

      return {
        status: 200,
        body: {
          pullRequests: formattedPRs,
          totalCount: openPRs.length
        }
      }

    } catch (error: any) {
      logger.error('GitHub API error', { error: error.message })
      return {
        status: 400,
        body: { error: `GitHub API error: ${error.message}` }
      }
    }

  } catch (error: any) {
    logger.error('PR fetch failed', { error: error.message, stack: error.stack })
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}
