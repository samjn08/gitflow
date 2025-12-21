import React, { useState, useEffect } from 'react'
import apiClient from '../services/apiClient'
import { StaticAnalysisResult, AIReviewResult } from '../../types/audit'

interface AnalysisDetailModalProps {
  isOpen: boolean
  onClose: () => void
  analysisData: {
    stepName: string
    sessionId: string
    analysisType: 'static' | 'ai-review' | 'final-verdict'
    label: string
    status: string
    data?: any
    verdictData?: any
  } | null
}

export const AnalysisDetailModal: React.FC<AnalysisDetailModalProps> = ({
  isOpen,
  onClose,
  analysisData,
}) => {
  const [detailedData, setDetailedData] = useState<StaticAnalysisResult | AIReviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && analysisData) {
      // For final verdict, we don't need to fetch - data is passed directly
      if (analysisData.analysisType === 'final-verdict') {
        setDetailedData(analysisData.verdictData)
        setLoading(false)
        setError(null)
      } else {
        fetchDetailedAnalysis()
      }
    }
  }, [isOpen, analysisData])

  const fetchDetailedAnalysis = async () => {
    if (!analysisData) return

    setLoading(true)
    setError(null)

    try {
      console.log('Fetching analysis data:', {
        url: `/api/audit/analysis/${analysisData.sessionId}/${analysisData.analysisType}`,
        sessionId: analysisData.sessionId,
        analysisType: analysisData.analysisType
      })

      const response = await apiClient.get(
        `/audit/analysis/${analysisData.sessionId}/${analysisData.analysisType}`
      )

      console.log('API Response:', response.data)
      setDetailedData(response.data.data)
    } catch (err: any) {
      console.error('Failed to fetch analysis details:', err)
      console.error('Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      })

      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load analysis details'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !analysisData) return null

  const renderStaticAnalysisDetails = (data: StaticAnalysisResult) => (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-background-secondary p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-3">Security Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{data.score}%</div>
            <div className="text-sm text-foreground-secondary">Security Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{data.secrets.length}</div>
            <div className="text-sm text-foreground-secondary">Secrets Found</div>
          </div>
        </div>
      </div>

      {/* Secrets Found */}
      {data.secrets.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-error mb-3">🔐 Secrets Detected</h3>
          <div className="space-y-2">
            {data.secrets.map((secret, index) => (
              <div key={index} className="bg-error/10 border border-error/20 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-error">{secret.type}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    secret.severity === 'high' ? 'bg-error text-background' :
                    secret.severity === 'medium' ? 'bg-warning text-background' :
                    'bg-foreground-secondary/20 text-foreground-secondary'
                  }`}>
                    {secret.severity}
                  </span>
                </div>
                <div className="text-sm text-foreground-secondary mt-1">
                  {secret.file}:{secret.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vulnerabilities */}
      {data.vulnerabilities.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-warning mb-3">⚠️ Vulnerabilities Found</h3>
          <div className="space-y-2">
            {data.vulnerabilities.map((vuln, index) => (
              <div key={index} className="bg-warning/10 border border-warning/20 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-warning">{vuln.type}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    vuln.severity === 'critical' ? 'bg-error text-background' :
                    vuln.severity === 'high' ? 'bg-error/80 text-background' :
                    vuln.severity === 'medium' ? 'bg-warning text-background' :
                    'bg-foreground-secondary/20 text-foreground-secondary'
                  }`}>
                    {vuln.severity}
                  </span>
                </div>
                <div className="text-sm text-foreground-secondary mt-1">
                  {vuln.file}
                </div>
                <div className="text-sm mt-1">{vuln.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.secrets.length === 0 && data.vulnerabilities.length === 0 && (
        <div className="text-center py-8">
          <div className="text-success text-4xl mb-2">✅</div>
          <h3 className="text-lg font-semibold text-success">No Security Issues Found</h3>
          <p className="text-foreground-secondary">The static analysis completed successfully with no detected secrets or vulnerabilities.</p>
        </div>
      )}
    </div>
  )

  const renderAIReviewDetails = (data: AIReviewResult) => (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-background-secondary p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-3">AI Review Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{data.overall_score}%</div>
            <div className="text-sm text-foreground-secondary">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{data.critical_issues.length}</div>
            <div className="text-sm text-foreground-secondary">Critical Issues</div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-foreground-secondary">{data.summary}</p>
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">📊 Category Scores</h3>
        <div className="space-y-3">
          {Object.entries(data.categories).map(([category, details]) => (
            <div key={category} className="bg-background-secondary p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">{category.replace('_', ' ')}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  details.score >= 80 ? 'bg-success text-background' :
                  details.score >= 60 ? 'bg-warning text-background' :
                  'bg-error text-background'
                }`}>
                  {details.score}%
                </span>
              </div>
              <p className="text-sm text-foreground-secondary mb-2">{details.feedback}</p>
              {details.suggestions.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary mb-1">Suggestions:</div>
                  <ul className="text-xs text-foreground-secondary space-y-1">
                    {details.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-primary mr-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Critical Issues */}
      {data.critical_issues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-error mb-3">🚨 Critical Issues</h3>
          <div className="space-y-2">
            {data.critical_issues.map((issue, index) => (
              <div key={index} className="bg-error/10 border border-error/20 p-3 rounded">
                <div className="flex items-start">
                  <span className="text-error mr-2 mt-0.5">•</span>
                  <span className="text-foreground-secondary">{issue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderFinalVerdictDetails = (data: any) => (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-background-secondary p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-3">Final Audit Verdict</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${data.verdict === 'Safe' ? 'text-success' : data.verdict === 'Needs Changes' ? 'text-warning' : 'text-error'}`}>
              {data.verdict}
            </div>
            <div className="text-sm text-foreground-secondary">Verdict</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{data.confidence}%</div>
            <div className="text-sm text-foreground-secondary">Confidence</div>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-foreground-secondary">{data.summary}</p>
        </div>
      </div>

      {/* Critical Issues */}
      {data.critical_issues && data.critical_issues.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-error mb-3">🚨 Critical Issues</h3>
          <div className="space-y-2">
            {data.critical_issues.map((issue: string, index: number) => (
              <div key={index} className="bg-error/10 border border-error/20 p-3 rounded">
                <div className="flex items-start">
                  <span className="text-error mr-2 mt-0.5">•</span>
                  <span className="text-foreground-secondary">{issue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-primary mb-3">💡 Recommendations</h3>
          <div className="space-y-2">
            {data.recommendations.map((rec: string, index: number) => (
              <div key={index} className="bg-primary/10 border border-primary/20 p-3 rounded">
                <div className="flex items-start">
                  <span className="text-primary mr-2 mt-0.5">•</span>
                  <span className="text-foreground-secondary">{rec}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      {data.timestamp && (
        <div className="text-center py-4 border-t border-border">
          <div className="text-sm text-foreground-secondary">
            Analysis completed on {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card max-w-5xl w-full max-h-[90vh] overflow-hidden animate-bounce-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-border-light/50">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${
              analysisData.analysisType === 'static' ? 'bg-primary/20' :
              analysisData.analysisType === 'ai-review' ? 'bg-secondary/20' :
              'bg-success/20'
            }`}>
              <span className="text-2xl">
                {analysisData.analysisType === 'static' ? '🔒' :
                 analysisData.analysisType === 'ai-review' ? '🤖' : '✅'}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{analysisData.label}</h2>
              <p className="text-foreground-tertiary flex items-center space-x-2">
                <span>{analysisData.stepName}</span>
                <span>•</span>
                <code className="bg-background-tertiary px-2 py-1 rounded text-xs">
                  {analysisData.sessionId.slice(0, 8)}...
                </code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-border/50 rounded-xl transition-all duration-200 hover:rotate-90 focus-ring"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(83vh-180px)] custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="relative mb-4">
                <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping"></div>
              </div>
              <span className="text-foreground-secondary font-medium">Analyzing data...</span>
              <div className="mt-2 w-32 h-1 bg-background-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-shimmer rounded-full"></div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error/20 p-6 rounded-xl animate-slide-up">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-error/20 rounded-lg">
                  <svg className="w-6 h-6 text-error" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <span className="text-error font-semibold text-lg">Analysis Error</span>
                  <p className="text-foreground-secondary mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && detailedData && (
            <>
              {analysisData.analysisType === 'static' && renderStaticAnalysisDetails(detailedData as StaticAnalysisResult)}
              {analysisData.analysisType === 'ai-review' && renderAIReviewDetails(detailedData as AIReviewResult)}
              {analysisData.analysisType === 'final-verdict' && renderFinalVerdictDetails(detailedData)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-4 p-8 border-t border-border-light/50 bg-background-secondary/50">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-background-tertiary hover:bg-border text-foreground-secondary hover:text-foreground rounded-xl transition-all duration-200 font-medium focus-ring"
          >
            Close
          </button>
          {!loading && detailedData && (
            <button
              onClick={() => window.print()}
              className="btn-modern"
            >
              <span className="flex items-center space-x-2">
                <span>📄</span>
                <span>Export Report</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
