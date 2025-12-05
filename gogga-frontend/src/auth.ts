/**
 * GOGGA - NextAuth v5 Configuration
 * 
 * Token-based passwordless authentication:
 * 1. User enters email
 * 2. Server generates one-time token, sends via EmailJS
 * 3. User clicks link or pastes token
 * 4. NextAuth validates and creates session
 * 
 * Connection-type logging only - no personal data beyond email
 */
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import prisma from '@/lib/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'email-token',
      name: 'Email Token',
      credentials: {
        token: { label: 'Token', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.token) {
          return null
        }

        const token = (credentials.token as string).trim()
        
        try {
          // Find the token
          const tokenRecord = await prisma.loginToken.findUnique({
            where: { token }
          })

          if (!tokenRecord) {
            // Log failed attempt (connection logging only)
            await prisma.authLog.create({
              data: {
                action: 'login_failed',
                meta: JSON.stringify({ reason: 'invalid_token' })
              }
            })
            return null
          }

          // Check if already used
          if (tokenRecord.used) {
            await prisma.authLog.create({
              data: {
                email: tokenRecord.email,
                action: 'login_failed',
                meta: JSON.stringify({ reason: 'token_already_used' })
              }
            })
            return null
          }

          // Check if expired
          if (tokenRecord.expiresAt < new Date()) {
            await prisma.authLog.create({
              data: {
                email: tokenRecord.email,
                action: 'login_failed',
                meta: JSON.stringify({ reason: 'token_expired' })
              }
            })
            return null
          }

          // Mark token as used atomically
          await prisma.loginToken.update({
            where: { token },
            data: { used: true }
          })

          // Upsert user (create if new, update timestamp if exists)
          const user = await prisma.user.upsert({
            where: { email: tokenRecord.email },
            update: { updatedAt: new Date() },
            create: { email: tokenRecord.email }
          })

          // Log successful login
          await prisma.authLog.create({
            data: {
              email: user.email,
              action: 'login_success',
              meta: JSON.stringify({ method: 'email_token' })
            }
          })

          // Return user object for JWT
          return {
            id: user.id,
            email: user.email
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    }
  },

  trustHost: true,
  
  debug: process.env.NODE_ENV === 'development',
})
