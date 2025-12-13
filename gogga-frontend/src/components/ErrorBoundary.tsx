'use client'

/**
 * Global Error Boundary Components for Gogga
 * Provides graceful error handling across the application
 */

import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Base Error Boundary Component
 * Can be used with custom fallback or default error UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    
    // Log to external service if configured (e.g., Sentry, LogRocket)
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('error_boundary_triggered', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="font-quicksand text-2xl font-bold">
                Eish! Something went wrong
              </h1>
              <p className="font-quicksand text-sm text-muted-foreground">
                We encountered an unexpected error. Please try again.
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg bg-muted p-4 text-left">
                <p className="font-mono text-xs text-destructive break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.reset}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-quicksand text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 font-quicksand text-sm font-semibold hover:bg-accent"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Global Error Boundary for root layout
 */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex min-h-screen items-center justify-center bg-white p-4">
          <div className="max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            <div className="space-y-2">
              <h1 className="font-quicksand text-2xl font-bold text-black">
                GOGGA Encountered an Error
              </h1>
              <p className="font-quicksand text-sm text-gray-600">
                Don't worry, your data is safe. Please refresh the page or go back home.
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg bg-gray-100 border border-gray-300 p-4 text-left">
                <p className="font-mono text-xs text-red-600 break-all">
                  {error.message}
                </p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-quicksand text-xs text-gray-700">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 overflow-auto font-mono text-xs text-gray-600">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-quicksand text-sm font-semibold text-white hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-quicksand text-sm font-semibold hover:bg-gray-50"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Chat-specific error boundary
 */
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex h-full items-center justify-center p-4">
          <div className="max-w-sm space-y-4 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="font-quicksand text-lg font-semibold">
                Chat Error
              </h2>
              <p className="font-quicksand text-sm text-muted-foreground">
                The chat encountered an error. Your messages are still saved.
              </p>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-quicksand text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Chat
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Page-level error boundary wrapper
 */
export function PageErrorBoundary({ 
  children, 
  pageName 
}: { 
  children: ReactNode
  pageName?: string 
}) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="max-w-md space-y-4 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="font-quicksand text-xl font-semibold">
                Page Error{pageName ? `: ${pageName}` : ''}
              </h2>
              <p className="font-quicksand text-sm text-muted-foreground">
                This page encountered an error. Please try reloading.
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg bg-muted p-3 text-left">
                <p className="font-mono text-xs text-destructive break-all">
                  {error.message}
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-quicksand text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 font-quicksand text-sm font-semibold hover:bg-accent"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
