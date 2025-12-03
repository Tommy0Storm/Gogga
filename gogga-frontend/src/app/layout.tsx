import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GOGGA - South African AI Assistant',
  description: 'A Sovereign Bicameral AI Architecture for the South African Digital Ecosystem',
  keywords: ['AI', 'South Africa', 'chat', 'assistant', 'POPIA', 'legal'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
