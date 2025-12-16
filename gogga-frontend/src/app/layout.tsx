import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/components/AuthProvider'
import { GlobalErrorBoundary } from '@/components/ErrorBoundary'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Quicksand font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Google Material Icons (Black, Outlined) */}
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined"
          rel="stylesheet"
        />
        {/* PostHog initialized via instrumentation-client.ts */}
      </head>
      <body
        className="font-quicksand font-normal antialiased"
        suppressHydrationWarning
      >
        <GlobalErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
