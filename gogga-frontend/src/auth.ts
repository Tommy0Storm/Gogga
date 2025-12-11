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

// Custom logger to suppress expected JWT errors (stale/missing tokens)
const customLogger = {
  error: (error: Error) => {
    // Suppress JWTSessionError - these happen normally when no session exists
    // or when a session token is stale (SECRET changed)
    if (error.name === 'JWTSessionError' ||
      error.message?.includes('no matching decryption secret')) {
      return // Silently ignore - this is expected behavior
    }
    console.error('[auth] Error:', error)
  },
  warn: (code: string) => {
    console.warn('[auth] Warning:', code)
  },
  debug: (message: string, metadata?: unknown) => {
    // Debug disabled in production
    if (process.env.NODE_ENV === 'development') {
      console.log('[auth] Debug:', message, metadata)
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  logger: customLogger,
  providers: [
    Credentials({
      id: 'email-token',
      name: 'Email Token',
      credentials: {
        token: { label: 'Token', type: 'text' },
        clientIp: { label: 'Client IP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token) {
          return null;
        }

        const token = (credentials.token as string).trim();
        const clientIp = (credentials.clientIp as string) || null;

        try {
          // Find the token
          const tokenRecord = await prisma.loginToken.findUnique({
            where: { token },
          });

          if (!tokenRecord) {
            // Log failed attempt (connection logging only)
            await prisma.authLog.create({
              data: {
                action: 'login_failed',
                ip: clientIp,
                meta: JSON.stringify({ reason: 'invalid_token' }),
              },
            });
            return null;
          }

          // Check if already used
          if (tokenRecord.used) {
            await prisma.authLog.create({
              data: {
                email: tokenRecord.email,
                action: 'login_failed',
                ip: clientIp,
                meta: JSON.stringify({ reason: 'token_already_used' }),
              },
            });
            return null;
          }

          // Check if expired
          if (tokenRecord.expiresAt < new Date()) {
            await prisma.authLog.create({
              data: {
                email: tokenRecord.email,
                action: 'login_failed',
                ip: clientIp,
                meta: JSON.stringify({ reason: 'token_expired' }),
              },
            });
            return null;
          }

          // Mark token as used atomically
          await prisma.loginToken.update({
            where: { token },
            data: { used: true },
          });

          // Upsert user (create if new, update timestamp if exists)
          // New users automatically get FREE tier subscription
          const user = await prisma.user.upsert({
            where: { email: tokenRecord.email },
            update: { updatedAt: new Date() },
            create: {
              email: tokenRecord.email,
              subscription: {
                create: {
                  tier: 'FREE',
                  status: 'active',
                  startedAt: new Date(),
                },
              },
            },
            include: { subscription: true },
          });

          // Ensure existing users have a subscription (backfill)
          if (!user.subscription) {
            await prisma.subscription.create({
              data: {
                userId: user.id,
                tier: 'FREE',
                status: 'active',
                startedAt: new Date(),
              },
            });
          }

          // Get the user's current subscription tier
          const subscription =
            user.subscription ||
            (await prisma.subscription.findUnique({
              where: { userId: user.id },
            }));

          // Log successful login with tier info
          await prisma.authLog.create({
            data: {
              email: user.email,
              action: 'login_success',
              ip: clientIp,
              meta: JSON.stringify({
                method: 'email_token',
                tier: subscription?.tier || 'FREE',
                isNewUser: !user.subscription,
              }),
            },
          });

          // Return user object for JWT (includes tier)
          return {
            id: user.id,
            email: user.email,
            tier: (subscription?.tier || 'FREE') as 'FREE' | 'JIVE' | 'JIGGA',
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
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
        token.id = user.id;
        token.email = user.email;
        token.tier = user.tier || 'FREE';
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;

        // CRITICAL: Always fetch fresh tier from database
        // Tier can change via PayFast ITN webhook or admin actions
        // Don't rely on JWT token which is set at login time
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { subscription: true },
          });
          session.user.tier = (user?.subscription?.tier || 'FREE') as
            | 'FREE'
            | 'JIVE'
            | 'JIGGA';
          session.user.isAdmin = user?.isAdmin || false;
          session.user.isTester = user?.isTester || false;
        } catch (error) {
          console.error('Session tier lookup error:', error);
          session.user.tier = token.tier || 'FREE';
        }
      }
      return session;
    },
  },

  trustHost: true,

  // Disable debug logging to prevent noisy console errors
  // Enable temporarily for troubleshooting auth issues
  debug: false,
});
