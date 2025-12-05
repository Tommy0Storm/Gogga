# GOGGA Authentication System

## Overview

GOGGA uses a token-based passwordless authentication system built with:
- **NextAuth.js v5.0.0-beta.30** - Latest App Router compatible version
- **Prisma** (v5.22.0) - SQLite ORM
- **EmailJS REST API** - Magic link delivery (service_q6alymo, template_k9ugryd)

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOGGA PASSWORDLESS AUTH                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER ENTERS EMAIL → /login page                             │
│     └─→ POST /api/auth/request-token                            │
│         └─→ Generate 32-byte hex token (crypto.randomBytes)     │
│         └─→ Store in LoginToken table (15 min expiry)           │
│         └─→ Send via EmailJS REST API                           │
│                                                                 │
│  2. USER RECEIVES EMAIL                                         │
│     └─→ Email contains magic link: /login?token=xxx             │
│     └─→ Or user can paste token manually                        │
│                                                                 │
│  3. TOKEN VERIFICATION                                          │
│     └─→ signIn('email-token', { token, redirect: false })       │
│     └─→ Credentials provider authorize() validates:             │
│         • Token exists in DB                                    │
│         • Token not used                                        │
│         • Token not expired                                     │
│     └─→ Mark token as used                                      │
│     └─→ Upsert User (create if new, update if exists)           │
│     └─→ Log AUTH event to AuthLog table                         │
│                                                                 │
│  4. SESSION CREATED                                             │
│     └─→ JWT stored in cookie (30 days)                          │
│     └─→ Redirect to / (main app)                                │
│     └─→ useSession() hook available throughout app              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Route Protection

Server-side protection using NextAuth v5 `auth()`:

```
/ (Main App):
  - page.tsx: Server component, calls auth()
  - ChatClient.tsx: Client component, actual UI
  - No session → redirect('/login')

/login:
  - page.tsx: Server component, calls auth()
  - LoginClient.tsx: Client component, login form
  - Has session → redirect('/')
```

## Key Files

| File | Purpose |
|------|---------|
| `src/auth.ts` | NextAuth v5 config (handlers, signIn, signOut, auth exports) |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/components/AuthProvider.tsx` | SessionProvider wrapper |
| `src/app/login/page.tsx` | Server component - auth check |
| `src/app/login/LoginClient.tsx` | Client component - login form |
| `src/app/page.tsx` | Server component - auth check |
| `src/app/ChatClient.tsx` | Client component - main chat UI |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth v5 handlers export |
| `src/app/api/auth/request-token/route.ts` | Token generation + EmailJS REST API |
| `prisma/schema.prisma` | User, LoginToken, AuthLog, Subscription models |

## NextAuth v5 Configuration

```typescript
// src/auth.ts - NextAuth v5 pattern
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'email-token',
      name: 'Email Token',
      credentials: { token: { type: 'text' } },
      authorize: async (credentials) => {
        // Validate token, upsert user, return user object
      }
    })
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: { jwt, session }
})

// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

## Database Schema

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  tokens       LoginToken[]
  subscription Subscription?
}

// NOTE: LoginToken has NO foreign key to User
// This allows tokens to be created before user exists (signup flow)
model LoginToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  // No User relation - intentional for signup flow
}

model AuthLog {
  id        String   @id @default(cuid())
  email     String?  // Only for dispute investigation
  action    String   // token_requested, login_success, login_failed, session_created
  ip        String?  // Connection logging for security
  meta      String?  // JSON string (tier, userAgent, etc.)
  createdAt DateTime @default(now())
}

model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  tier        String    // FREE, JIVE, JIGGA
  status      String    // pending, active, cancelled, expired
  payfastToken String?  // For cancellation via PayFast API
  startedAt   DateTime?
  nextBilling DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}
```

## EmailJS Configuration

| Setting | Value |
|---------|-------|
| Service ID | `service_q6alymo` |
| Template ID | `template_k9ugryd` |
| Public Key | `Z6bj2q-HzyhKlxNEA` |
| Private Key | `wAHoHct3rPmGBBSKf6nTh` (stored in .env.local) |
| API Endpoint | `https://api.emailjs.com/api/v1.0/email/send` |

**Template Variables:**
- `{{email}}` - Recipient email (MUST be used in "To Email" field)
- `{{token}}` - 64-character login token
- `{{magic_link}}` - Full magic link URL

**Important:** EmailJS template must have "To Email" field set to `{{email}}` for dynamic recipient.

## AuthLog Events

| Action | When Logged | Metadata |
|--------|-------------|----------|
| `token_requested` | User requests magic link | tier, timestamp |
| `login_success` | Successful token verification | tier, isNewUser |
| `login_failed` | Invalid/expired token | reason |
| `session_created` | JWT session established | sessionMaxAge |
| `logout` | User signs out | - |
| `subscription_activated` | PayFast confirms payment | tier, payfastToken |
| `subscription_cancelled` | User cancels subscription | tier |

## Subscription Assignment

Every new user is automatically assigned FREE tier on first login:

```typescript
// In auth.ts authorize callback
const user = await prisma.user.upsert({
  where: { email: tokenRecord.email },
  update: { updatedAt: new Date() },
  create: {
    email: tokenRecord.email,
    subscription: {
      create: {
        tier: 'FREE',
        status: 'active',
        startedAt: new Date()
      }
    }
  },
  include: { subscription: true }
})

// Backfill for existing users without subscription
if (!user.subscription) {
  await prisma.subscription.create({...})
}
```

The tier is included in the JWT session:
- `session.user.tier` → 'FREE' | 'JIVE' | 'JIGGA'

Utility functions in `src/lib/subscription.ts`:
- `getUserSubscription(userId)` - Get subscription from DB
- `requireTier(minTier)` - Require tier or redirect
- `hasTier(userTier, requiredTier)` - Check tier without redirect
- `getTierInfo(tier)` - Get display info for tier

## Session Management

| Aspect | Value |
|--------|-------|
| Strategy | JWT (stateless) |
| Max Age | 30 days |
| Cookie Name | `authjs.session-token` (production) |
| Secure | true (HTTPS only) |
| SameSite | lax |

**Session Access:**
```typescript
// Client-side
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()

// Server-side (App Router)
import { auth } from '@/auth'
const session = await auth()
```

## Privacy Policy

- **User controls data**: All chat/RAG data stored locally in browser (IndexedDB)
- **Minimal server data**: Only email stored for authentication
- **Connection logging only**: AuthLog stores action types and IPs for dispute investigation
- **No personal data logging**: Beyond what's required for security and disputes
- **POPIA compliant**: User can request data deletion at any time
- **Token expiry**: Magic tokens auto-expire after 15 minutes

## Environment Variables

```bash
# .env.local (gogga-frontend)

# NextAuth v5
AUTH_SECRET=xxx  # openssl rand -base64 32
NEXTAUTH_URL=https://localhost:3005

# Database
DATABASE_URL="file:./dev.db"

# EmailJS (REST API)
EMAILJS_PUBLIC_KEY=Z6bj2q-HzyhKlxNEA
EMAILJS_PRIVATE_KEY=xxx
EMAILJS_SERVICE_ID=service_q6alymo
EMAILJS_TEMPLATE_ID=template_k9ugryd

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_yZekB4PmawZNhcDehM9C1hcjMtMcqG36xHZu6AveT33
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## Development Notes

1. **NextAuth v5 vs v4**: Use `next-auth@5.0.0-beta.30`, not v4. The config pattern is different.
2. **LoginToken FK**: No foreign key to User - allows signup flow where user doesn't exist yet
3. **EmailJS REST API**: Use direct fetch to `https://api.emailjs.com/api/v1.0/email/send` instead of `@emailjs/nodejs` library
4. **Template Variable**: EmailJS template must use `{{email}}` (not `to_email`) for the recipient
5. **Port**: Dev server runs on HTTPS :3005 (not :3000) due to SSL requirements