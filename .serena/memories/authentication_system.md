# GOGGA Authentication System

## Overview

GOGGA uses a token-based passwordless authentication system built with:
- **NextAuth.js** (v4.24.13) - Credentials provider
- **Prisma** (v5.22.0) - SQLite ORM
- **EmailJS** (service_q6alymo) - Magic link delivery via Outlook

## Authentication Flow

1. User enters email at `/login`
2. `POST /api/auth/request-token` generates 64-char hex token
3. Token stored in `LoginToken` table (15 min expiry)
4. Magic link sent via EmailJS to user's email
5. User clicks link or pastes token manually
6. NextAuth Credentials provider validates token
7. JWT session created (30-day expiry)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth configuration, Credentials provider |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/components/AuthProvider.tsx` | SessionProvider wrapper |
| `src/app/login/page.tsx` | Login UI with email/token forms |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth API handlers |
| `src/app/api/auth/request-token/route.ts` | Magic link generator |
| `src/app/api/payfast/notify/route.ts` | PayFast ITN webhook |
| `prisma/schema.prisma` | User, LoginToken, AuthLog, Subscription models |
| `src/types/next-auth.d.ts` | TypeScript type extensions |

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

model LoginToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User?    @relation(fields: [email], references: [email])
}

model AuthLog {
  id        String   @id @default(cuid())
  email     String?
  action    String   // token_requested, login_success, login_failed, etc.
  ip        String?
  meta      String?  // JSON
  createdAt DateTime @default(now())
}

model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  tier        String    // FREE, JIVE, JIGGA
  status      String    // pending, active, cancelled, expired
  payfastToken String?
  startedAt   DateTime?
  nextBilling DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}
```

## Privacy Policy

- **User controls data**: All chat/RAG data stored locally in browser (IndexedDB)
- **Minimal server data**: Only email stored for authentication
- **Connection logging only**: AuthLog stores action types and IPs for dispute investigation
- **No personal data logging**: Beyond what's required for security and disputes
- **POPIA compliant**: User can request data deletion at any time

## EmailJS Templates

| Template ID | Purpose |
|-------------|---------|
| `template_magic_token` | Magic sign-in link |
| `vcb_welcome_free` | FREE tier welcome |
| `vcb_subscription_activation_with_privacy` | Subscription confirmed |
| `vcb_payment_success` | Payment processed |
| `vcb_payment_failed` | Payment failed |
| `vcb_subscription_cancelled` | Cancellation notice |

## PayFast Integration

- ITN webhook: `/api/payfast/notify`
- IP whitelist verification (production)
- MD5 signature validation (quote_plus encoding)
- Subscription status: pending → active → cancelled/expired
- Token stored for cancellation API calls
