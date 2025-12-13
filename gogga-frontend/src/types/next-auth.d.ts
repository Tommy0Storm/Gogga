/**
 * GOGGA - NextAuth Type Extensions
 * 
 * Extends the default NextAuth types to include custom user properties.
 * Includes tier for subscription management.
 */
import 'next-auth'
import 'next-auth/jwt'

// Tier type for subscription levels
export type UserTier = 'FREE' | 'JIVE' | 'JIGGA'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      tier: UserTier
      isAdmin?: boolean
      isTester?: boolean
      name?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
    email: string
    tier: UserTier
    isAdmin?: boolean
    isTester?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    tier: UserTier
  }
}
