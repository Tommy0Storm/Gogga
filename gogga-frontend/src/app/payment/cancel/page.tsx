/**
 * GOGGA - Payment Cancelled Page
 * 
 * Shown when user cancels PayFast payment.
 */
import Link from 'next/link'
import { PageErrorBoundary } from '@/components/ErrorBoundary'

export default function PaymentCancelPage() {
  return (
    <PageErrorBoundary pageName="Payment Cancel">
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Cancel Icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-gray-400 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No charges have been made to your account.
        </p>

        <div className="space-y-3">
          <Link
            href="/upgrade"
            className="block w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Return to Chat
          </Link>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Changed your mind? You can upgrade anytime from your account menu.
        </p>
      </div>
    </div>
    </PageErrorBoundary>
  )
}
