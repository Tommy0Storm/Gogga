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
        {/* Material Icons - optimized loading */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined&display=swap"
          as="style"
        />
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined&display=swap"
          rel="stylesheet"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelectorAll('link[media="print"]')[0].media='all'`,
          }}
        />
        {/* PostHog initialized via instrumentation-client.ts */}
      </head>
      <body
<<<<<<< Updated upstream
        className="font-quicksand font-normal antialiased relative"
=======
        className={`${quicksand.className} font-normal antialiased`}
>>>>>>> Stashed changes
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
