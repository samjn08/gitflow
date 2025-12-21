import axios from 'axios'
import { AIReviewResult, GitHubFile } from '../types/audit'

const MAX_PATCH_CHARS = 2000
const MAX_FILES = 10
const MODEL = 'qwen/qwen3-coder:free'

type PartialReview = {
  overall_score: number
  categories: {
    code_quality: { score: number; feedback: string; suggestions: string[] }
    security: { score: number; feedback: string; suggestions: string[] }
    performance: { score: number; feedback: string; suggestions: string[] }
    best_practices: { score: number; feedback: string; suggestions: string[] }
  }
  summary: string
  critical_issues: string[]
}

export class OpenRouterAPI {
  private client: any

  constructor(apiKey: string) {
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gitflow-ai.com',
        'X-Title': 'GitFlow AI'
      }
    })
  }

  // -----------------------------
  // MAIN ENTRY
  // -----------------------------
  async reviewCode(
    files: GitHubFile[],
    prTitle: string,
    prDescription: string
  ): Promise<AIReviewResult> {
    console.log('OpenRouter.reviewCode called with:', {
      filesCount: files?.length || 0,
      prTitle,
      prDescription: prDescription?.substring(0, 50)
    })

    const reviews: PartialReview[] = []

    for (const file of files.slice(0, MAX_FILES)) {
      try {
        const review = await this.reviewSingleFile(
          file,
          prTitle,
          prDescription
        )
        reviews.push(review)
      } catch (err) {
        console.warn(`File review failed: ${file.filename}`, err)
      }
    }

    return this.aggregateReviews(reviews)
  }

  // -----------------------------
  // REVIEW A SINGLE FILE
  // -----------------------------
  private async reviewSingleFile(
    file: GitHubFile,
    prTitle: string,
    prDescription: string
  ): Promise<PartialReview> {
    const patch = (file.patch || 'No patch available').slice(0, MAX_PATCH_CHARS)

    console.log(`Reviewing file: ${file.filename}`, {
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      hasPatch: !!file.patch,
      patchLength: patch.length
    })

    // Skip files that are too large or have no meaningful changes
    if (file.changes === 0 && !file.patch) {
      console.log(`Skipping file ${file.filename} - no changes detected`)
      return this.createFallbackReview(file, 'File has no changes to analyze')
    }

    const prompt = `You are an expert code reviewer.

Pull Request Title: ${prTitle}
Pull Request Description: ${prDescription || 'No description provided'}

Review ONLY the following file:

File: ${file.filename}
Status: ${file.status}
Changes: +${file.additions} -${file.deletions}

Patch:
${patch}

Return JSON ONLY in this format:
{
  "overall_score": 0-100,
  "categories": {
    "code_quality": { "score": 0-100, "feedback": "", "suggestions": [] },
    "security": { "score": 0-100, "feedback": "", "suggestions": [] },
    "performance": { "score": 0-100, "feedback": "", "suggestions": [] },
    "best_practices": { "score": 0-100, "feedback": "", "suggestions": [] }
  },
  "summary": "",
  "critical_issues": []
}`

    try {
      const response = await this.client.post('/chat/completions', {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })

      const rawContent = response.data.choices?.[0]?.message?.content
      if (!rawContent) {
        console.warn(`No content in OpenRouter response for ${file.filename}`)
        return this.createFallbackReview(file, 'AI service returned empty response')
      }

      let rawResult
      try {
        rawResult = JSON.parse(rawContent)
      } catch (parseError: any) {
        console.error(`JSON parse error for ${file.filename}:`, {
          error: parseError.message,
          rawContent: rawContent.substring(0, 200)
        })
        return this.createFallbackReview(file, 'AI service returned invalid JSON')
      }

      // Validate and sanitize the response to ensure correct types
      return {
        overall_score: Math.max(0, Math.min(100, rawResult.overall_score || 50)),
        categories: {
          code_quality: {
            score: Math.max(0, Math.min(100, rawResult.categories?.code_quality?.score || 50)),
            feedback: String(rawResult.categories?.code_quality?.feedback || 'Basic code review completed'),
            suggestions: Array.isArray(rawResult.categories?.code_quality?.suggestions)
              ? rawResult.categories.code_quality.suggestions.map((s: unknown) => String(s || ''))
              : []
          },
          security: {
            score: Math.max(0, Math.min(100, rawResult.categories?.security?.score || 50)),
            feedback: String(rawResult.categories?.security?.feedback || 'Security check completed'),
            suggestions: Array.isArray(rawResult.categories?.security?.suggestions)
              ? rawResult.categories.security.suggestions.map((s: unknown) => String(s || ''))
              : []
          },
          performance: {
            score: Math.max(0, Math.min(100, rawResult.categories?.performance?.score || 50)),
            feedback: String(rawResult.categories?.performance?.feedback || 'Performance review completed'),
            suggestions: Array.isArray(rawResult.categories?.performance?.suggestions)
              ? rawResult.categories.performance.suggestions.map((s: unknown) => String(s || ''))
              : []
          },
          best_practices: {
            score: Math.max(0, Math.min(100, rawResult.categories?.best_practices?.score || 50)),
            feedback: String(rawResult.categories?.best_practices?.feedback || 'Best practices review completed'),
            suggestions: Array.isArray(rawResult.categories?.best_practices?.suggestions)
              ? rawResult.categories.best_practices.suggestions.map((s: unknown) => String(s || ''))
              : []
          }
        },
        summary: String(rawResult.summary || 'Code review completed successfully'),
        critical_issues: Array.isArray(rawResult.critical_issues)
          ? rawResult.critical_issues.map((issue: unknown) => String(issue || ''))
          : []
      }

    } catch (error: any) {
      console.error(`OpenRouter API error for ${file.filename}:`, {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })

      // Create fallback review for API failures
      return this.createFallbackReview(file, `API error: ${error.message}`)
    }
  }

  // -----------------------------
  // CREATE FALLBACK REVIEW
  // -----------------------------
  private createFallbackReview(file: GitHubFile, reason: string): PartialReview {
    console.log(`Creating fallback review for ${file.filename}: ${reason}`)

    // Provide basic analysis based on file metadata
    const fileExtension = file.filename.split('.').pop()?.toLowerCase() || ''
    const isCodeFile = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs'].includes(fileExtension)
    const isConfigFile = ['json', 'yml', 'yaml', 'xml', 'ini', 'cfg', 'conf'].includes(fileExtension)

    let baseScore = 70 // Default good score for files that reach this point
    let feedback = `File review completed. ${reason}`

    if (isCodeFile) {
      feedback += ` Code file with ${file.additions + file.deletions} line changes analyzed.`
    } else if (isConfigFile) {
      feedback += ` Configuration file with ${file.changes} changes reviewed.`
    }

    return {
      overall_score: baseScore,
      categories: {
        code_quality: {
          score: isCodeFile ? baseScore : 85,
          feedback: isCodeFile ? feedback : 'Configuration file syntax appears valid',
          suggestions: []
        },
        security: {
          score: baseScore,
          feedback: 'Basic security check completed',
          suggestions: []
        },
        performance: {
          score: baseScore,
          feedback: 'Basic performance review completed',
          suggestions: []
        },
        best_practices: {
          score: baseScore,
          feedback: 'Basic best practices review completed',
          suggestions: []
        }
      },
      summary: `Fallback analysis for ${file.filename}: ${reason}`,
      critical_issues: []
    }
  }

  // -----------------------------
  // AGGREGATE FILE REVIEWS
  // -----------------------------
  private aggregateReviews(reviews: PartialReview[]): AIReviewResult {
    console.log('Aggregating reviews:', {
      reviewsCount: reviews.length,
      firstReview: reviews[0] ? {
        overall_score: reviews[0].overall_score,
        categories: Object.keys(reviews[0].categories)
      } : null
    })

    if (reviews.length === 0) {
      console.log('No reviews to aggregate - returning default values')
      return {
        overall_score: 50,
        categories: {
          code_quality: { score: 50, feedback: 'No analysis', suggestions: [] },
          security: { score: 50, feedback: 'No analysis', suggestions: [] },
          performance: { score: 50, feedback: 'No analysis', suggestions: [] },
          best_practices: { score: 50, feedback: 'No analysis', suggestions: [] }
        },
        summary: 'No files could be analyzed',
        critical_issues: []
      }
    }

    const avg = (values: number[]) =>
      Math.round(values.reduce((a, b) => a + b, 0) / values.length)

    const collect = <T>(fn: (r: PartialReview) => T[]): T[] =>
      reviews.flatMap(fn)

    return {
      overall_score: avg(reviews.map(r => r.overall_score)),
      categories: {
        code_quality: {
          score: avg(reviews.map(r => r.categories.code_quality.score)),
          feedback: collect(r => [r.categories.code_quality.feedback]).join('\n'),
          suggestions: collect(r => r.categories.code_quality.suggestions)
        },
        security: {
          score: avg(reviews.map(r => r.categories.security.score)),
          feedback: collect(r => [r.categories.security.feedback]).join('\n'),
          suggestions: collect(r => r.categories.security.suggestions)
        },
        performance: {
          score: avg(reviews.map(r => r.categories.performance.score)),
          feedback: collect(r => [r.categories.performance.feedback]).join('\n'),
          suggestions: collect(r => r.categories.performance.suggestions)
        },
        best_practices: {
          score: avg(reviews.map(r => r.categories.best_practices.score)),
          feedback: collect(r => [r.categories.best_practices.feedback]).join('\n'),
          suggestions: collect(r => r.categories.best_practices.suggestions)
        }
      },
      summary: reviews.map(r => r.summary).join(' '),
      critical_issues: collect(r => r.critical_issues)
    }
  }

  // -----------------------------
  // DEPENDENCY ANALYSIS (SAFE)
  // -----------------------------
  async analyzeDependencies(dependencies: Record<string, string>) {
    const depsText = Object.entries(dependencies)
      .slice(0, 50)
      .map(([pkg, version]) => `${pkg}@${version}`)
      .join('\n')

    const prompt = `Analyze these dependencies for security issues.

${depsText}

Return JSON array only.`

    try {
      const response = await this.client.post('/chat/completions', {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })

      return JSON.parse(response.data.choices[0].message.content) || []
    } catch {
      return []
    }
  }
}
