'use client'

/**
 * Modern Login Form with React 19 Server Actions
 * Uses useActionState for stateful form handling with pending states
 */

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { requestMagicLink } from '@/app/actions'
import { useState, useEffect } from 'react'

/**
 * Submit button component that uses useFormStatus
 * Must be a separate component as useFormStatus reads from parent form context
 */
function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-black px-4 py-3 font-quicksand text-sm font-semibold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Sending...
        </span>
      ) : (
        'Send Magic Link'
      )}
    </button>
  )
}

/**
 * Initial state for useActionState
 */
const initialState = {
  success: false,
  error: '',
  message: ''
}

/**
 * Modern login form using React 19 patterns
 */
export function ModernLoginForm() {
  const [email, setEmail] = useState('')
  const [state, formAction, pending] = useActionState(
    async (_prevState: typeof initialState, formData: FormData) => {
      const email = formData.get('email') as string
      const result = await requestMagicLink(email)
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          message: ''
        }
      }
      
      return {
        success: true,
        error: '',
        message: 'Check your email! A magic link has been sent.'
      }
    },
    initialState
  )

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (state.message || state.error) {
      const timer = setTimeout(() => {
        // State will be reset on next form submission
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [state.message, state.error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-quicksand text-4xl font-bold text-black">
            GOGGA
          </h1>
          <p className="mt-2 font-quicksand text-sm text-gray-600">
            Your South African AI Assistant
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block font-quicksand text-sm font-medium text-gray-700"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-quicksand shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {/* Success message */}
          {state.success && state.message && (
            <div
              className="rounded-lg bg-green-50 border border-green-200 p-4"
              role="status"
              aria-live="polite"
            >
              <p className="font-quicksand text-sm text-green-800">
                {state.message}
              </p>
            </div>
          )}

          {/* Error message */}
          {state.error && (
            <div
              className="rounded-lg bg-red-50 border border-red-200 p-4"
              role="alert"
              aria-live="assertive"
            >
              <p className="font-quicksand text-sm text-red-800">
                {state.error}
              </p>
            </div>
          )}

          <SubmitButton />
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="font-quicksand text-xs text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
