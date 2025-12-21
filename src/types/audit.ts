import { z } from 'zod'

// GitHub API Types
export const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
})

export const GitHubPRSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(['open', 'closed']),
  html_url: z.string(),
  user: GitHubUserSchema,
  created_at: z.string(),
  updated_at: z.string(),
  merged: z.boolean().nullable(),
  mergeable: z.boolean().nullable(),
  head: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
  }),
})

export const GitHubFileSchema = z.object({
  filename: z.string(),
  status: z.enum(['added', 'removed', 'modified', 'renamed']),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  patch: z.string().optional(),
})

// Audit Types
export const AuditConfigSchema = z.object({
  repositoryUrl: z.string().url(),
  openRouterKey: z.string(),
  prNumber: z.number().optional(),
})

export const PullRequestInfoSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  user: z.object({
    login: z.string(),
    avatar_url: z.string(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
})

export const StaticAnalysisResultSchema = z.object({
  secrets: z.array(z.object({
    file: z.string(),
    line: z.number(),
    type: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
  })),
  vulnerabilities: z.array(z.object({
    file: z.string(),
    type: z.string(),
    description: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
  })),
  score: z.number().min(0).max(100),
})

export const AIReviewResultSchema = z.object({
  overall_score: z.number().min(0).max(100),
  categories: z.record(z.string(), z.object({
    score: z.number().min(0).max(100),
    feedback: z.string(),
    suggestions: z.array(z.string()),
  })),
  summary: z.string(),
  critical_issues: z.array(z.string()),
})

export const DependencyRiskSchema = z.object({
  package: z.string(),
  version: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
  recommendation: z.string(),
})

export const AuditVerdictSchema = z.object({
  verdict: z.enum(['Safe', 'Needs Changes', 'Blocked']),
  confidence: z.number().min(0).max(100),
  summary: z.string(),
  critical_issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  timestamp: z.string(),
  finalized: z.boolean(),
})

// Step Execution Types
export const StepStatusSchema = z.enum(['idle', 'running', 'success', 'failed'])

export const StepExecutionSchema = z.object({
  stepId: z.string(),
  stepName: z.string(),
  status: StepStatusSchema,
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  error: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
})

// Audit Session Types
export const AuditSessionSchema = z.object({
  id: z.string(),
  config: AuditConfigSchema,
  status: z.enum(['initializing', 'running', 'completed', 'failed']),
  steps: z.array(StepExecutionSchema),
  currentStep: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Event Types for Streaming
export const AuditEventSchema = z.object({
  type: z.enum([
    'audit-started',
    'pr-data-fetched',
    'scan-complete',
    'ai-review-complete',
    'dependency-risk-found',
    'audit-finalized'
  ]),
  sessionId: z.string(),
  data: z.record(z.string(), z.any()),
  timestamp: z.string(),
})

// Type exports
export type GitHubUser = z.infer<typeof GitHubUserSchema>
export type GitHubPR = z.infer<typeof GitHubPRSchema>
export type GitHubFile = z.infer<typeof GitHubFileSchema>
export type AuditConfig = z.infer<typeof AuditConfigSchema>
export type PullRequestInfo = z.infer<typeof PullRequestInfoSchema>
export type StaticAnalysisResult = z.infer<typeof StaticAnalysisResultSchema>
export type AIReviewResult = z.infer<typeof AIReviewResultSchema>
export type DependencyRisk = z.infer<typeof DependencyRiskSchema>
export type AuditVerdict = z.infer<typeof AuditVerdictSchema>
export type StepStatus = z.infer<typeof StepStatusSchema>
export type StepExecution = z.infer<typeof StepExecutionSchema>
export type AuditSession = z.infer<typeof AuditSessionSchema>
export type AuditEvent = z.infer<typeof AuditEventSchema>
