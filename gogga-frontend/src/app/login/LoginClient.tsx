/**
 * GOGGA - Login Client Component
 * 
 * Two-step passwordless authentication:
 * 1. Enter email → receive magic link
 * 2. Click link OR paste token → authenticated
 * 
 * Follows GOGGA monochrome design with Quicksand font
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'

// Separate component for the actual login form (uses useSearchParams)
function LoginForm() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'token'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [clientIp, setClientIp] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const tokenFromUrl = searchParams?.get('token')

  // Fetch client IP on mount
  useEffect(() => {
    fetch('/api/ip')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('unknown'))
  }, [])

  // Auto-login if token is in URL
  useEffect(() => {
    if (tokenFromUrl) {
      setLoading(true)
      setToken(tokenFromUrl)
      handleTokenLogin(tokenFromUrl)
    }
  }, [tokenFromUrl])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })

      const data = await res.json()

      if (data.ok) {
        setSuccess('Check your email! A sign-in link has been sent.')
        setStep('token')
      } else {
        setError(data.message || 'Failed to send email. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTokenLogin(tokenValue: string) {
    setError('')
    setLoading(true)

    try {
      const result = await signIn('email-token', {
        token: tokenValue.trim(),
        clientIp: clientIp || 'unknown',
        redirect: false,
        callbackUrl: '/'
      })

      if (result?.error) {
        setError('Invalid or expired token. Please request a new one.')
        setStep('email')
      } else if (result?.ok) {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) {
      setError('Please enter the token from your email')
      return
    }
    handleTokenLogin(token)
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* GOGGA Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
            GOGGA
          </h1>
          <p className="text-neutral-400">
            South African AI Assistant
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {step === 'email' ? 'Sign In' : 'Enter Your Token'}
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-900 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-950/50 border border-green-900 rounded-lg text-green-400 text-sm">
              <p>{success}</p>
              <p className="mt-2 text-xs text-green-500">
                💡 Can&apos;t find it? Check your spam or junk folder.
              </p>
            </div>
          )}

          {step === 'email' ? (
            /* Email Entry Form */
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm text-neutral-400 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg 
                           text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500
                           disabled:opacity-50 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-white text-neutral-900 font-semibold rounded-lg
                         hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Sign-In Link'
                )}
              </button>
            </form>
          ) : (
            /* Token Entry Form */
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm text-neutral-400 mb-2">
                  Paste Token from Email
                </label>
                <input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your token here"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg 
                           text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500
                           disabled:opacity-50 transition-colors font-mono text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token.trim()}
                className="w-full py-3 bg-white text-neutral-900 font-semibold rounded-lg
                         hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setToken('')
                  setError('')
                  setSuccess('')
                }}
                className="w-full py-2 text-neutral-400 hover:text-white text-sm transition-colors"
              >
                ← Back to email
              </button>
            </form>
          )}

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
            <p className="text-sm text-neutral-500">
              No password needed. We&apos;ll send you a secure link.
            </p>
            <p className="text-xs text-neutral-600 mt-2">
              Link expires in 15 minutes • Need help?{' '}
              <a href="mailto:hello@vcb-ai.online" className="text-neutral-400 hover:text-white">
                hello@vcb-ai.online
              </a>
            </p>
          </div>
        </div>

        {/* Privacy Notice */}
        <p className="mt-6 text-center text-xs text-neutral-600">
          GOGGA respects your privacy. We only store your email for authentication.
          <br />
          You control your data. POPIA compliant.
        </p>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function LoginLoading() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  )
}

// Main export with Suspense boundary
export function LoginClient() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
