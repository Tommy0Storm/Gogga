/**
 * GOGGA - Login Page (Server Component)
 * 
 * Server-side protection:
 * - If already logged in → redirect to /
 * - If not logged in → show login form
 * 
 * This is the recommended approach for NextAuth v5:
 * Use `auth()` on the server side, not client-side checks
 */
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LoginClient } from './LoginClient'

export default async function LoginPage() {
  // Server-side session check
  const session = await auth()
  
  if (session) {
    // Already logged in - redirect to main app
    redirect('/')
  }
  
  // Not logged in - render login form
  return <LoginClient />
}
