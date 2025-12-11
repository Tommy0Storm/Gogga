# GOGGA Subscription System

## Overview

GOGGA uses a 3-tier subscription model with PayFast (South African gateway) for payments.

## Tier Structure

| Tier | Price | AI Model | Speed | Images | RAG Docs |
|------|-------|----------|-------|--------|----------|
| **FREE** | R0 | Llama 3.3 70B (OpenRouter) | Standard | 50/mo (text only) | ❌ |
| **JIVE** | R99/mo | Llama 3.3 70B (Cerebras) + CePO | ~2,200 t/s | 200/mo (FLUX 1.1) | 5/session |
| **JIGGA** | R299/mo | Qwen 3 32B (Cerebras) | ~1,400 t/s | 1,000/mo (FLUX 1.1) | 10/session |

## Key JIGGA Features
- **Thinking Mode**: Extended reasoning with `<think>` blocks (collapsible UI)
- **Semantic RAG**: E5-small embeddings (384-dim) for vector similarity search
- **Cross-Session Docs**: Access documents from any past session
- **RAG Analytics Dashboard**: Live performance graphs, vector scoring
- **Authoritative Mode**: AI quotes directly from documents only

## Auto-Assignment

Every user gets FREE tier automatically on first login:

```typescript
// In auth.ts authorize callback
const user = await prisma.user.upsert({
  create: {
    email: tokenRecord.email,
    subscription: {
      create: { tier: 'FREE', status: 'active', startedAt: new Date() }
    }
  }
})
```

## Session Access

```typescript
const session = await auth()
session.user.tier  // 'FREE' | 'JIVE' | 'JIGGA'
```

## Utility Functions

Located in `src/lib/subscription.ts`:

| Function | Purpose |
|----------|---------|
| `getUserSubscription(userId)` | Get subscription from DB |
| `requireTier(minTier)` | Server component - redirect if insufficient |
| `hasTier(userTier, requiredTier)` | Client-side tier check |
| `getTierInfo(tier)` | Get display info (name, color, limits) |

## PayFast Integration

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/payments/subscribe` | POST | Create subscription form |
| `/api/v1/payments/notify` | POST | ITN webhook (PayFast → backend) |
| `/api/v1/payments/cancel/{token}` | POST | Cancel subscription |
| `/api/v1/payments/tiers` | GET | List tier options |
| `/api/v1/payments/credit-packs` | GET | List credit pack options |

### Credit Packs (Top-up)

| Pack | Price | Credits |
|------|-------|---------|
| Small | R200 | 50,000 |
| Medium | R500 | 150,000 |
| Large | R1000 | 350,000 |

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
