/**
 * GOGGA - NextAuth Route Handler
 * 
 * Handles all /api/auth/* routes:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/callback/email-token
 * - /api/auth/session
 */
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
