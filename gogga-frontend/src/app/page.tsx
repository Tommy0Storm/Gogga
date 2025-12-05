/**
 * GOGGA - Main App Page (Server Component)
 * 
 * Server-side protection:
 * - If not logged in → redirect to /login
 * - If logged in → render main chat UI
 * 
 * This is the recommended approach for NextAuth v5:
 * Use `auth()` on the server side for route protection
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { ChatClient } from './ChatClient'

export default async function HomePage() {
  // Server-side session check
  const session = await auth()
  
  if (!session) {
    // Not logged in - redirect to login
    redirect('/login')
  }
  
  // Logged in - render main chat UI
  return <ChatClient />
}
