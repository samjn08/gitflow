import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AuditConfig, PullRequestInfo } from '../../types/audit'

const Home: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<AuditConfig>({
    repositoryUrl: '',
    openRouterKey: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pullRequests, setPullRequests] = useState<PullRequestInfo[]>([])
  const [prLoading, setPrLoading] = useState(false)
  const [prError, setPrError] = useState('')
  const [selectedPR, setSelectedPR] = useState<PullRequestInfo | null>(null)

  // Fetch PRs when repository URL changes
  useEffect(() => {
    const fetchPullRequests = async () => {
      if (!formData.repositoryUrl.trim()) {
        setPullRequests([])
        setSelectedPR(null)
        setPrError('')
        return
      }

      // Basic URL validation
      try {
        const url = new URL(formData.repositoryUrl)
        if (!url.hostname.includes('github.com')) {
          setPullRequests([])
          setSelectedPR(null)
          setPrError('')
          return
        }
        const pathParts = url.pathname.split('/').filter(Boolean)
        if (pathParts.length < 2) {
          setPullRequests([])
          setSelectedPR(null)
          setPrError('')
          return
        }
      } catch {
        setPullRequests([])
        setSelectedPR(null)
        setPrError('')
        return
      }

      setPrLoading(true)
      setPrError('')
      setPullRequests([])
      setSelectedPR(null)

      try {
        const response = await axios.get('/api/pull-requests', {
          params: { repositoryUrl: formData.repositoryUrl }
        })

        const { pullRequests: prs, totalCount } = response.data
        setPullRequests(prs)

        if (prs.length === 0) {
          setPrError('No open pull requests found in this repository')
        } else {
          // Auto-select the most recent PR (first in the array)
          setSelectedPR(prs[0])
          setFormData(prev => ({ ...prev, prNumber: prs[0].number }))
        }
      } catch (err: any) {
        setPrError(err.response?.data?.error || 'Failed to fetch pull requests')
        setPullRequests([])
        setSelectedPR(null)
      } finally {
        setPrLoading(false)
      }
    }

    // Debounce the fetch to avoid too many requests
    const timeoutId = setTimeout(fetchPullRequests, 500)
    return () => clearTimeout(timeoutId)
  }, [formData.repositoryUrl])

  const validateForm = () => {
    if (!formData.repositoryUrl.trim()) {
      return 'GitHub Repository URL is required'
    }

    try {
      const url = new URL(formData.repositoryUrl)
      if (!url.hostname.includes('github.com')) {
        return 'Please enter a valid GitHub repository URL'
      }
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length < 2) {
        return 'Please enter a complete GitHub repository URL (https://github.com/owner/repo)'
      }
    } catch {
      return 'Please enter a valid URL format'
    }

    if (!selectedPR) {
      return 'Please select a pull request to audit'
    }

    if (!formData.openRouterKey.trim()) {
      return 'OpenRouter API Key is required'
    }

    if (!formData.openRouterKey.startsWith('sk-or-v1-')) {
      return 'Please enter a valid OpenRouter API key (should start with sk-or-v1-)'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post('/api/audit/start', formData, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const { sessionId } = response.data
      navigate(`/audit/${sessionId}`)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start audit. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof AuditConfig) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background relative overflow-hidden">
      {/* Background decoration - optimized for performance */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-primary-light)_0%,transparent_50%)] opacity-10"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full space-y-12">
          {/* Hero Section */}
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-primary">AI-Powered Code Analysis</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-primary-light to-secondary bg-clip-text text-transparent mb-4 animate-bounce-in">
              GitFlow AI
            </h1>

            <p className="text-xl md:text-2xl text-foreground-secondary mb-6 font-light">
              Autonomous PR Auditor
            </p>

            <p className="text-lg text-foreground-tertiary max-w-lg mx-auto leading-relaxed">
              Analyze any GitHub repository with cutting-edge AI-powered code review and comprehensive security scanning
            </p>
          </div>

          {/* Main Form Card */}
          <div className="glass-card animate-slide-up hover-lift">
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">🚀 Start New Audit</h2>
                <p className="text-foreground-secondary">
                  Configure your repository and let AI do the heavy lifting
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Repository URL */}
                <div className="animate-slide-in">
                  <label htmlFor="repositoryUrl" className="form-label flex items-center space-x-2">
                    <span>🔗 GitHub Repository URL</span>
                    <span className="text-error">*</span>
                  </label>
                  <input
                    id="repositoryUrl"
                    type="url"
                    required
                    placeholder="https://github.com/owner/repo"
                    value={formData.repositoryUrl}
                    onChange={handleInputChange('repositoryUrl')}
                    className="modern-input w-full focus-ring"
                  />
                  <p className="text-xs text-foreground-tertiary mt-2 flex items-center space-x-1">
                    <span>🔒</span>
                    <span>Supports public repositories only</span>
                  </p>
                </div>

                {/* Pull Request Selection */}
                {formData.repositoryUrl && (
                  <div className="animate-slide-in" style={{ animationDelay: '0.1s' }}>
                    <label htmlFor="prSelect" className="form-label flex items-center space-x-2">
                      <span>📋 Pull Request to Audit</span>
                      <span className="text-error">*</span>
                    </label>
                    {prLoading ? (
                      <div className="flex items-center space-x-3 py-4 px-4 bg-background-tertiary rounded-lg">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-foreground-secondary">Fetching pull requests...</span>
                      </div>
                    ) : prError ? (
                      <div className="bg-error/10 border border-error/20 rounded-lg p-4 animate-shake">
                        <div className="flex items-center space-x-2">
                          <span className="text-error">⚠️</span>
                          <p className="text-error text-sm">{prError}</p>
                        </div>
                      </div>
                    ) : pullRequests.length > 0 ? (
                      <select
                        id="prSelect"
                        value={selectedPR?.number || ''}
                        onChange={(e) => {
                          const prNumber = parseInt(e.target.value)
                          const pr = pullRequests.find(p => p.number === prNumber)
                          setSelectedPR(pr || null)
                          setFormData(prev => ({ ...prev, prNumber: pr?.number }))
                        }}
                        className="modern-input w-full focus-ring"
                        required
                      >
                        <option value="">Select a pull request...</option>
                        {pullRequests.map((pr) => (
                          <option key={pr.number} value={pr.number}>
                            #{pr.number} - {pr.title}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {selectedPR && (
                      <div className="mt-3 p-4 bg-background-tertiary rounded-lg border border-border-light animate-fade-in">
                        <div className="flex items-start space-x-3">
                          <img
                            src={selectedPR.user.avatar_url}
                            alt={selectedPR.user.login}
                            className="w-10 h-10 rounded-full ring-2 ring-primary/20"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {selectedPR.title}
                            </p>
                            <p className="text-xs text-foreground-tertiary flex items-center space-x-1">
                              <span>👤</span>
                              <span>{selectedPR.user.login}</span>
                              <span>•</span>
                              <span>{new Date(selectedPR.created_at).toLocaleDateString()}</span>
                            </p>
                            <a
                              href={selectedPR.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-xs text-primary hover:text-primary-light transition-colors mt-1"
                            >
                              <span>View on GitHub</span>
                              <span>→</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OpenRouter API Key */}
                <div className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
                  <label htmlFor="openRouterKey" className="form-label flex items-center space-x-2">
                    <span>🤖 OpenRouter API Key</span>
                    <span className="text-error">*</span>
                  </label>
                  <input
                    id="openRouterKey"
                    type="password"
                    required
                    placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={formData.openRouterKey}
                    onChange={handleInputChange('openRouterKey')}
                    className="modern-input w-full focus-ring"
                  />
                  <p className="text-xs text-foreground-tertiary mt-2 flex items-center space-x-1">
                    <span>⚡</span>
                    <span>Used for AI-powered code analysis.</span>
                    <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-light underline">
                      Get one here
                    </a>
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-error/10 border border-error/20 rounded-lg p-4 animate-bounce-in">
                    <div className="flex items-center space-x-2">
                      <span className="text-error text-lg">⚠️</span>
                      <p className="text-error text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !selectedPR}
                  className={`w-full btn-modern ${loading || !selectedPR ? 'opacity-60 cursor-not-allowed' : ''} animate-slide-in`}
                  style={{ animationDelay: '0.3s' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-semibold">Initializing AI Audit...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold">🚀 Start AI Audit</span>
                    </div>
                  )}
                </button>
              </form>

              {/* Features Section */}
              <div className="mt-8 pt-6 border-t border-border-light">
                <h3 className="text-lg font-semibold text-foreground mb-6 text-center">✨ What happens next?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 animate-slide-in hover-lift" style={{ animationDelay: '0.4s' }}>
                    <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-background">
                      1
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">PR Analysis</p>
                      <p className="text-xs text-foreground-secondary">Fetch and analyze pull request changes</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-secondary/5 to-secondary/10 border border-secondary/20 animate-slide-in hover-lift" style={{ animationDelay: '0.5s' }}>
                    <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm font-bold text-background">
                      2
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Security Scan</p>
                      <p className="text-xs text-foreground-secondary">Detect secrets and vulnerabilities</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-warning/5 to-warning/10 border border-warning/20 animate-slide-in hover-lift" style={{ animationDelay: '0.6s' }}>
                    <div className="flex-shrink-0 w-8 h-8 bg-warning rounded-full flex items-center justify-center text-sm font-bold text-background">
                      3
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">AI Review</p>
                      <p className="text-xs text-foreground-secondary">Comprehensive code quality analysis</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4 p-4 rounded-lg bg-gradient-to-r from-success/5 to-success/10 border border-success/20 animate-slide-in hover-lift" style={{ animationDelay: '0.7s' }}>
                    <div className="flex-shrink-0 w-8 h-8 bg-success rounded-full flex items-center justify-center text-sm font-bold text-background">
                      ✓
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Final Verdict</p>
                      <p className="text-xs text-foreground-secondary">Authoritative Safe/Needs Changes/Blocked decision</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
