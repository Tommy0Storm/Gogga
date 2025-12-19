# GOGGA Subscription System

## Overview

GOGGA uses a 3-tier subscription model with PayFast (South African gateway) for payments.
Credits can be purchased for usage beyond subscription limits.

## Tier Structure (Updated Dec 2025)

| Tier | Price | AI Model | Speed | Chat Tokens | Images | GoggaTalk |
|------|-------|----------|-------|-------------|--------|-----------|
| **FREE** | R0 | Qwen 235B (OpenRouter) | Slow | Unlimited | 50/mo | ❌ |
| **JIVE** | R99/mo | Qwen 32B (Cerebras) | ~2,600 t/s | 500K/mo | 20/mo | 30 min/mo |
| **JIGGA** | R299/mo | Qwen 32B + 235B | ~2,600 t/s | 2M/mo | 70/mo | 25 min/mo |

## JIVE Tier Details (R99/month)
- **Chat**: 500K tokens (Qwen 32B)
- **Images**: 20 creates (NO edits or upscales)
- **Video**: 5 seconds (1 short clip)
- **GoggaTalk**: 30 minutes voice chat
- **Credit Packs**: Can only use for chat, image create, and voice

## JIGGA Tier Details (R299/month)
- **Chat**: 2M tokens (32B + 235B routing)
- **Images**: 70 creates + 30 edits
- **Upscales**: 10 (Imagen 4 Ultra)
- **Video**: 16 seconds (2 videos)
- **GoggaTalk**: 25 minutes voice chat
- **Credit Packs**: No restrictions - all features

## Credit Packs (Top-up)

### JIVE Credit Packs
| Pack | Credits | Price | Restrictions |
|------|---------|-------|--------------|
| Starter | 50 | R49 | Chat, Images, Voice only |
| Standard | 100 | R89 | Chat, Images, Voice only |
| Plus | 175 | R129 | Chat, Images, Voice only (+17% bonus) |

### JIGGA Credit Packs  
| Pack | Credits | Price | Restrictions |
|------|---------|-------|--------------|
| Pro | 150 | R149 | None |
| Business | 320 | R279 | None (+7% bonus) |
| Enterprise | 700 | R549 | None (+17% bonus) |

**Credit Value**: 1 credit = $0.10 USD = R1.90 ZAR

**Credit Costs**:
- 10K tokens: 1 credit
- 1 image: 1 credit
- 1 edit: 1 credit
- 1 upscale: 1 credit
- 1 sec video: 2 credits
- 1 min GoggaTalk: 1 credit

### Subscription Lifecycle

```
1. FIRST LOGIN → Auto-create FREE tier subscription
2. USER UPGRADES → PayFast payment → ITN webhook updates tier
3. ACTIVE → Full tier features, nextBilling set
4. CANCELLATION → status='cancelled', access until nextBilling
5. EXPIRY → Reverts to FREE tier
```

## Database Schema

```prisma
model Subscription {
  id          String    @id @default(cuid())
  userId      String    @unique
  tier        String    // FREE, JIVE, JIGGA
  status      String    // pending, active, cancelled, expired, past_due
  payfastToken String?  // For cancellation API
  startedAt   DateTime?
  nextBilling DateTime?
  paymentFailedAt DateTime?  // When payment last failed
  retryCount  Int @default(0)  // PayFast retry attempts
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id])
}

model ProcessedPayment {
  id          String   @id @default(cuid())
  pfPaymentId String   @unique  // Idempotency key
  type        String   // "subscription" | "credit_pack"
  amount      Int      // cents
  userId      String
  processedAt DateTime @default(now())
}

model CreditPurchase {
  id        String    @id @default(cuid())
  userId    String
  packSize  String    // "200" | "500" | "1000"
  credits   Int       // 50000, 150000, 350000
  remaining Int       // Current balance
  expiresAt DateTime? // Optional 12-month expiry
  createdAt DateTime  @default(now())
}
```

## Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User clicks "Upgrade to JIVE" on /upgrade                   │
│  2. Frontend calls POST /api/payments/subscribe                 │
│  3. Backend generates signed PayFast form data                  │
│  4. Frontend renders hidden form, auto-submits to PayFast       │
│  5. User completes payment on PayFast                           │
│  6. PayFast sends ITN to /api/v1/payments/notify                │
│  7. Backend verifies signature + IP whitelist                   │
│  8. Backend updates subscription.tier in database               │
│  9. User's next request sees new tier in session                │
└─────────────────────────────────────────────────────────────────┘
```

## PayFast Signature Rules

**CRITICAL**: Use `quote_plus` for spaces (+ not %20)

```python
# Correct
query_parts = [f"{key}={urllib.parse.quote_plus(str(value))}"]
query_string += f"&passphrase={passphrase_encoded}"
signature = hashlib.md5(query_string.encode("utf-8")).hexdigest()
```

## Implementation Status

### ✅ Complete
- Backend PayFast service (signature, form generation)
- ITN webhook handler with idempotency
- Payment failure tracking (past_due, retryCount)
- Subscription model with all fields
- FREE tier auto-assignment
- Tier enforcement utilities
- Account menu with tier display
- Upgrade page UI

### 🔜 Pending
- Email templates for payment events
- Credit expiry enforcement

## Single Source of Truth

The frontend tier display uses SQLite (Prisma) as the authoritative source:

```typescript
// AccountMenu.tsx - Fetches fresh tier on mount
useEffect(() => {
  fetch('/api/subscription')
    .then(res => res.json())
    .then(data => setSubscription(data))
}, [])

// Uses DB tier, falls back to session prop
const tier = (subscription?.tier || currentTier) as keyof typeof TIER_STYLES
```

- **Admin changes**: Update SQLite via `/api/subscriptions/action` endpoint
- **Frontend reads**: Fetches from `/api/subscription` which queries Prisma
- **Session callback**: Also reads fresh tier from DB (auth.ts lines 190-200)

This ensures tier changes in admin panel are immediately reflected in the header.

## Files

### Backend
- `app/services/payfast_service.py` - Signature generation
- `app/api/v1/endpoints/payments.py` - Payment endpoints
- `app/services/subscription_service.py` - Tier enforcement

### Frontend
- `src/lib/subscription.ts` - Utility functions
- `src/hooks/useSubscription.ts` - React hook
- `src/app/upgrade/page.tsx` - Upgrade page
- `src/app/api/subscription/route.ts` - Subscription API
- `src/components/AccountMenu.tsx` - Account dropdown
- `prisma/schema.prisma` - Database models
