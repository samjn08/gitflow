import axios, { AxiosInstance } from 'axios'
import { GitHubPR, GitHubFile, AuditConfig } from '../types/audit'

export class GitHubAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitFlow-AI/1.0'
      }
    })
  }

  // Parse GitHub repository URL to extract owner and repo
  static parseRepoUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!match) return null
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
  }

  // Get repository information
  async getRepository(owner: string, repo: string) {
    const response = await this.client.get(`/repos/${owner}/${repo}`)
    return response.data
  }

  // Get pull request details
  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    const response = await this.client.get(`/repos/${owner}/${repo}/pulls/${prNumber}`)
    return response.data
  }

  // Get pull request files (diff)
  async getPullRequestFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/pulls/${prNumber}/files`)
    return response.data
  }

  // Get list of open pull requests
  async getOpenPullRequests(owner: string, repo: string): Promise<GitHubPR[]> {
    const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
      params: { state: 'open', per_page: 10 }
    })
    return response.data
  }

  // Get repository contents (for dependency analysis)
  async getFileContent(owner: string, repo: string, path: string, ref?: string) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/contents/${path}`, {
        params: ref ? { ref } : undefined
      })
      return response.data
    } catch (error) {
      return null // File doesn't exist
    }
  }
}

// Static analysis utilities
export class StaticAnalyzer {
  // Common secret patterns to detect
  private static readonly SECRET_PATTERNS = [
    /api[_-]?key[\s]*[=:][\s]*["']?.{20,}/i,
    /apikey[\s]*[=:][\s]*["']?.{20,}/i,
    /secret[_-]?key[\s]*[=:][\s]*["']?.{20,}/i,
    /password[\s]*[=:][\s]*["']?.{8,}/i,
    /token[\s]*[=:][\s]*["']?.{20,}/i,
    /bearer[\s]*[=:][\s]*["']?.{20,}/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /sk-[a-zA-Z0-9]{48}/, // OpenAI API keys
    /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Slack tokens
  ]

  // Vulnerability patterns
  private static readonly VULNERABILITY_PATTERNS: Array<{
    pattern: RegExp
    type: string
    severity: 'high' | 'medium' | 'low'
    description: string
  }> = [
    {
      pattern: /eval\s*\(/,
      type: 'Code Injection',
      severity: 'high',
      description: 'Use of eval() can lead to code injection vulnerabilities'
    },
    {
      pattern: /innerHTML\s*=.*\+/,
      type: 'XSS Vulnerability',
      severity: 'high',
      description: 'Direct assignment to innerHTML with concatenation can lead to XSS'
    },
    {
      pattern: /console\.log.*(?:password|token|key|secret)/i,
      type: 'Information Disclosure',
      severity: 'medium',
      description: 'Logging sensitive information to console'
    }
  ]

  static analyzeDiff(files: GitHubFile[]) {
    const secrets: Array<{file: string, line: number, type: string, severity: 'high' | 'medium' | 'low'}> = []
    const vulnerabilities: Array<{file: string, type: string, description: string, severity: 'critical' | 'high' | 'medium' | 'low'}> = []

    for (const file of files) {
      if (file.patch) {
        const lines = file.patch.split('\n')
        let currentLine = 0

        for (const line of lines) {
          currentLine++

          // Check for secrets
          for (const pattern of this.SECRET_PATTERNS) {
            const match = line.match(pattern)
            if (match) {
              secrets.push({
                file: file.filename,
                line: currentLine,
                type: 'Potential Secret Leak',
                severity: 'high'
              })
            }
          }

          // Check for vulnerabilities
          for (const vuln of this.VULNERABILITY_PATTERNS) {
            if (vuln.pattern.test(line)) {
              vulnerabilities.push({
                file: file.filename,
                type: vuln.type,
                description: vuln.description,
                severity: vuln.severity
              })
            }
          }
        }
      }
    }

    // Calculate security score (0-100, higher is better)
    const secretPenalty = secrets.length * 20
    const vulnPenalty = vulnerabilities.reduce((acc, v) => {
      const severityScore = { critical: 25, high: 15, medium: 8, low: 3 }
      return acc + severityScore[v.severity]
    }, 0)

    const score = Math.max(0, 100 - secretPenalty - vulnPenalty)

    return {
      secrets,
      vulnerabilities,
      score
    }
  }
}
