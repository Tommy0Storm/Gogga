import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { AuthProvider } from '@/components/AuthProvider'
import { GlobalErrorBoundary } from '@/components/ErrorBoundary'
import { BugReportButton } from '@/components/BugReportButton'
import './globals.css'

// Use local font to avoid Turbopack Google Fonts resolution bug in Next.js 16
const quicksand = localFont({
  src: [
    {
      path: '../../public/fonts/quicksand-latin.woff2',
      weight: '400 700',
      style: 'normal',
    },
  ],
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
