import type { Metadata, Viewport } from 'next'
import { Quicksand } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { GlobalErrorBoundary } from '@/components/ErrorBoundary'
import { BugReportButton } from '@/components/BugReportButton'
import './globals.css'

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  variable: '--font-quicksand',
})

export const metadata: Metadata = {
  title: 'GOGGA - South African AI Assistant',
  description: 'A Sovereign Bicameral AI Architecture for the South African Digital Ecosystem',
  keywords: ['AI', 'South Africa', 'chat', 'assistant', 'POPIA', 'legal'],
  icons: {
    icon: '/favicon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#262626',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={quicksand.variable}>
      <head>
        {/* Material Icons */}
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined&display=swap"
          rel="stylesheet"
        />
        {/* PostHog initialized via instrumentation-client.ts */}
      </head>
      <body
        className={`${quicksand.className} font-normal antialiased`}
        suppressHydrationWarning
      >
        <GlobalErrorBoundary>
          <AuthProvider>
            {children}
            <BugReportButton />
          </AuthProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
