# Gogga Credit & Token System

> **Last Updated:** December 19, 2025
> **Status:** ✅ IMPLEMENTED - Enterprise-grade features complete

## Overview

Token-based billing with subscription tiers, credit packs, and automatic free tier fallback.

---

## Verified Vendor Pricing (December 2025)

### Cerebras Qwen (Text Chat)
| Model | Input/M | Output/M | Speed |
|-------|---------|----------|-------|
| Qwen 3 32B | $0.40 | $0.80 | ~2,600 t/s |
| Qwen 3 235B | $0.60 | $1.20 | ~1,400 t/s |

### Vertex AI (Images/Video)
| Service | Cost |
|---------|------|
| Imagen 3 (create/edit) | $0.04/image |
| Imagen 4 (upscale) | $0.06/image |
| Veo 2 (video) | $0.20/sec |

### Gemini Live (Voice)
| Service | Cost |
|---------|------|
| GoggaTalk | $0.0225/min |

---

## Subscription Tiers

### FREE (R0)
| Feature | Limit | Provider |
|---------|-------|----------|
| Chat | Unlimited | OpenRouter Qwen 235B (slower) |
| Images | 50/month | Pollinations (free) |
| Video | ❌ | - |
| GoggaTalk | ❌ | - |
| Credit Packs | ❌ Cannot purchase | - |

### JIVE (R99/month = $5.21)
| Feature | Limit | Cost | Notes |
|---------|-------|------|-------|
| Chat | 500K tokens | $0.30 | Qwen 32B |
| Images | 20/month | $0.80 | Create only, NO edits |
| Video | 5 sec/month | $1.00 | 1 video |
| GoggaTalk | 30 min/month | $0.68 | Voice |
| **Total Cost** | | **$2.78** | **47% margin** |

**Credit Pack Restrictions:**
- ✅ Chat, Image create, GoggaTalk
- ❌ Image edit, Upscale, Video

### JIGGA (R299/month = $15.74)
| Feature | Limit | Cost | Notes |
|---------|-------|------|-------|
| Chat | 2M tokens | $1.20 | Qwen 32B + 235B routing |
| Images | 70/month | $2.80 | Create + edit |
| Upscales | 10/month | $0.60 | Imagen 4 |
| Video | 16 sec/month | $3.20 | 2 videos |
| GoggaTalk | 25 min/month | $0.56 | Voice |
| **Total Cost** | | **$8.36** | **47% margin** |

**Credit Pack Restrictions:** None - can use for anything

---

## Credit System

### Credit Value
**1 credit = $0.10 USD = R1.90 ZAR**

### Credit Costs Per Action
| Action | Credits | Notes |
|--------|---------|-------|
| 10K chat tokens | 1 | Input + output combined |
| 1 image (create) | 1 | All tiers |
| 1 image (edit) | 1 | JIGGA only |
| 1 upscale | 1 | JIGGA only |
| 1 sec video | 2 | JIGGA only |
| 1 min GoggaTalk | 1 | All paid tiers |

### JIVE Credit Packs
| Pack | Credits | Price (ZAR) | $/Credit | Margin | Bonus |
|------|---------|-------------|----------|--------|-------|
| Starter | 50 | R49 | $0.052 | 48% | - |
| Standard | 100 | R89 | $0.047 | 53% | - |
| Plus | 175 | R129 | $0.039 | 61% | +17% |

### JIGGA Credit Packs
| Pack | Credits | Price (ZAR) | $/Credit | Margin | Bonus |
|------|---------|-------------|----------|--------|-------|
| Pro | 150 | R149 | $0.052 | 48% | - |
| Business | 320 | R279 | $0.046 | 54% | +7% |
| Enterprise | 700 | R549 | $0.041 | 59% | +17% |

---

## Token Counting Flow

### 1. Pre-Request Check
```
User sends message
    │
    ▼
┌─────────────────────────┐
│ Estimate tokens needed  │
│ using gpt-tokenizer     │
│ (cl100k_base encoding)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ CreditService.check()   │
│ - Check subscription    │
│ - Check credit balance  │
│ - Determine fallback    │
└───────────┬─────────────┘
            │
            ▼
    Route to provider
```

### 2. Post-Response Deduction
```
Response received
    │
    ▼
┌─────────────────────────┐
│ Get actual token counts │
│ from API response:      │
│ - usage.prompt_tokens   │
│ - usage.completion_tokens│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ CreditService.deduct()  │
│ - Deduct from sub first │
│ - Then from credits     │
│ - Track for analytics   │
└─────────────────────────┘
```

### 3. Token Counting Accuracy

**Problem:** Different models tokenize differently.
**Solution:** Use actual API response token counts, not estimates.

```python
# In ai_service.py after each completion:
actual_tokens = {
    "input": response.usage.prompt_tokens,
    "output": response.usage.completion_tokens,
    "total": response.usage.total_tokens,
}

# Deduct based on ACTUAL usage
CreditService.deduct_usage(
    user_id=user_id,
    action="chat_10k_tokens",
    quantity=actual_tokens["total"] // 10000 + 1,  # Round up
    source=check_result.source
)
```

### 4. Token Estimation (for UI preview)
```typescript
// Frontend uses gpt-tokenizer for estimates
import { encode } from 'gpt-tokenizer/model/gpt-4o';

function estimateTokens(text: string): number {
  return encode(text).length;
}

// Show warning if approaching limit
const estimated = estimateTokens(userMessage);
if (usage.chatTokensUsed + estimated > limits.chatTokens) {
  showWarning("Will use credit pack for this message");
}
```

---

## Fallback Logic

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTION REQUESTED                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. CHECK SUBSCRIPTION LIMIT                                 │
│    usage[action] + quantity <= tier_limits[action]?         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │ YES                           │ NO
              ▼                               ▼
┌─────────────────────┐     ┌─────────────────────────────────┐
│ Use subscription    │     │ 2. CHECK TIER RESTRICTIONS      │
│ source="subscription"│     │    (JIVE can only use credits   │
│ ✓ ALLOWED           │     │     for chat/images/voice)      │
└─────────────────────┘     └─────────────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │ ALLOWED                       │ DENIED
                              ▼                               ▼
┌─────────────────────────────────────────┐   ┌──────────────────────┐
│ 3. CHECK CREDIT BALANCE                 │   │ Is it CHAT action?   │
│    credit_balance >= credits_needed?    │   └──────────┬───────────┘
└─────────────────────────────────────────┘              │
                              │               ┌──────────┴──────────┐
              ┌───────────────┴──────────┐    │ YES            │ NO
              │ YES                      │ NO ▼                ▼
              ▼                          │   ┌────────────┐  ┌────────────┐
┌─────────────────────┐                  │   │ Free tier  │  │ DENY       │
│ Deduct from credits │                  │   │ fallback   │  │ Show       │
│ source="credits"    │                  │   │ (OpenRouter)│  │ upgrade    │
│ ✓ ALLOWED           │                  │   └────────────┘  │ prompt     │
└─────────────────────┘                  │                   └────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │ Is it CHAT action?  │
                              └──────────┬──────────┘
                              ┌──────────┴──────────┐
                              │ YES            │ NO
                              ▼                ▼
                    ┌────────────────┐   ┌────────────────┐
                    │ Free fallback  │   │ DENY action    │
                    │ source="free"  │   │ reason=...     │
                    │ ✓ ALLOWED      │   │ ✗ DENIED       │
                    └────────────────┘   └────────────────┘
```

---

## Database Schema

### User Fields
```prisma
model User {
  // Credit system
  creditBalance      Int       @default(0)    // Can be negative for testing
  
  // Monthly usage (resets on billing date)
  usageChatTokens    Int       @default(0)
  usageImages        Int       @default(0)
  usageImageEdits    Int       @default(0)
  usageUpscales      Int       @default(0)
  usageVideoSeconds  Int       @default(0)
  usageGoggaTalkMins Float     @default(0)
  usageResetDate     DateTime  @default(now())
  
  creditPurchases    CreditPurchase[]
}
```

### Credit Purchase Tracking
```prisma
model CreditPurchase {
  id            String    @id @default(cuid())
  userId        String
  packId        String    // "jive_starter", "jigga_pro"
  packName      String
  credits       Int
  priceZAR      Int       // In cents
  paymentId     String?   // PayFast ID
  paymentStatus String    // pending, completed, failed
  createdAt     DateTime
  completedAt   DateTime?
}
```

---

## Admin Configuration

### Editable in Admin Panel

| Setting | Location | Current Value |
|---------|----------|---------------|
| Exchange rate | `gogga-backend/app/config.py` | R19/$ |
| JIVE price | Admin DB | R99 |
| JIGGA price | Admin DB | R299 |
| Credit pack prices | Admin DB | Variable |
| Tier limits | Admin DB + config.py | See tables above |

### Admin API Endpoints

```
GET  /api/admin/pricing           - Get all pricing config
PUT  /api/admin/pricing           - Update pricing
GET  /api/admin/tiers             - Get tier limits
PUT  /api/admin/tiers             - Update tier limits
GET  /api/admin/credit-packs      - Get pack definitions
PUT  /api/admin/credit-packs      - Update packs

GET  /api/admin/users/:id/credits - Get user credit status
PUT  /api/admin/users/:id/credits - Set credit balance
POST /api/admin/users/:id/grant   - Grant credits
POST /api/admin/users/:id/reset   - Reset monthly usage
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `gogga-backend/app/config.py` | Pricing constants, tier limits |
| `gogga-backend/app/services/credit_service.py` | Credit logic |
| `gogga-frontend/src/lib/creditSystem.ts` | Frontend credit checks |
| `gogga-admin/src/app/api/admin/pricing/route.ts` | Admin pricing API |
| `gogga-admin/src/app/api/admin/credits/route.ts` | Admin credit API |

---

## Enterprise-Grade Features (NEW Dec 2025)

### Idempotency (Prevents Double-Billing)
Uses CloudEvents-style idempotency keys: `{action}:{user_id}:{request_uuid}`

```python
# Backend generates unique key per request
idempotency_key = f"chat:{user_id}:{request_id}"

# Frontend deduplicates via unique constraint
model UsageEvent {
  idempotencyKey String @unique
}
```

### Atomic Transactions
All credit operations wrapped in Prisma `$transaction` for ACID compliance:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Check existing event (idempotency)
  // 2. Update user balance
  // 3. Create UsageEvent audit record
})
```

### Token Validation (10% Tolerance)
Catches manipulation attempts by comparing claimed vs actual token counts:

```python
@staticmethod
def validate_token_count(claimed: int, actual: int, tolerance: float = 0.1) -> bool:
    if actual == 0:
        return claimed <= 100  # Allow small claims with no response
    variance = abs(claimed - actual) / actual
    return variance <= tolerance
```

### Admin Audit Trail
All manual credit/tier adjustments logged with:
- Admin email and IP address
- Before/after balance
- Required reason (min 10 chars)
- Reference to related events

```typescript
model CreditAdjustment {
  id            String   @id
  userId        String
  amount        Int      // Positive=grant, negative=deduct
  balanceBefore Int
  balanceAfter  Int
  adjustmentType String  // GRANT, REFUND, CORRECTION, PROMO, CHARGEBACK
  reason        String   // Required, min 10 chars
  adminEmail    String?
  adminIp       String?
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/internal/user-usage/{userId}` | GET | Fetch user usage state |
| `/api/internal/deduct-usage` | POST | Deduct usage (idempotent) |
| `/api/admin/credits/adjust` | POST | Manual credit adjustment |
| `/api/admin/credits/adjust` | GET | List adjustments (paginated) |
| `/api/admin/tier/override` | POST | Override user tier |

---

## Test Users

Set test users to negative JIGGA balance (-158 credits):
```bash
cd gogga-frontend && npx tsx prisma/seed-negative-balances.ts
```

This simulates users who have exhausted subscription + credits for testing fallback.

---

## Related Memories

- `subscription_system.md` - PayFast integration
- `token_tracking.md` - Token display in UI
- `architecture.md` - Tier routing
