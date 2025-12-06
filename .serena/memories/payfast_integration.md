# PayFast Integration

## Overview
GOGGA uses PayFast (South African payment gateway) for all subscription and payment processing.

## Sandbox Credentials (Testing)
```
Merchant ID: 10000100
Merchant Key: 46f0cd694581a
Passphrase: jt7NOE43FZPn  # REQUIRED for subscriptions!
Sandbox URL: https://sandbox.payfast.co.za/eng/process
```

## CRITICAL: Signature Generation
PayFast requires **field order matching documentation order** (NOT alphabetical!):
1. merchant_id, merchant_key
2. return_url, cancel_url, notify_url
3. email_address (buyer details)
4. m_payment_id, amount, item_name
5. subscription_type, billing_date, recurring_amount, frequency, cycles

**API calls** (like cancel_subscription) use **alphabetical order**.

## Environment Variables (Backend .env)
```bash
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=jt7NOE43FZPn
PAYFAST_ENV=sandbox
APP_URL=http://192.168.0.168:3001  # For return redirects
API_URL=http://192.168.0.168:8000
```

## Local Development Testing
Since PayFast ITN can't reach local dev, use manual activation:
```bash
curl -X POST http://localhost:3000/api/internal/subscription-activate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-internal-key-change-in-production" \
  -d '{"email": "user@example.com", "tier": "JIVE"}'
```

## Payment Types

### 1. Subscription Tiers (Monthly Recurring)
| Tier | Price | Features |
|------|-------|----------|
| **JIVE** | R99/month | Cerebras Llama 3.3 70B, CePO, 200 images/month, 5 RAG docs |
| **JIGGA** | R299/month | Qwen 3 32B thinking mode, 1000 images/month, 10 RAG docs, semantic RAG |

### 2. Once-off Tier Purchase
Users can also purchase tier access as a one-time payment (not recurring).

### 3. Credit Packs (Top-up)
| Pack | Price | Credits |
|------|-------|---------|
| Small | R200 | 50,000 |
| Medium | R500 | 150,000 |
| Large | R1000 | 350,000 |

## API Endpoints

### Subscription/Tier Payment
```http
POST /api/v1/payments/subscribe
Body: {
  "user_email": "user@example.com",
  "tier": "jive" | "jigga",
  "payment_type": "subscription" | "once_off"
}
```

### Credit Pack Purchase
```http
POST /api/v1/payments/credit-pack
Body: {
  "user_email": "user@example.com",
  "pack_size": "200" | "500" | "1000"
}
```

### List Available Options
```http
GET /api/v1/payments/tiers         # Returns JIVE/JIGGA details
GET /api/v1/payments/credit-packs  # Returns pack options
```

### Cancel Subscription
```http
POST /api/v1/payments/cancel/{subscription_token}
```

## ITN Webhook (Instant Transaction Notification)
PayFast sends payment notifications to:
```
POST /api/v1/payments/notify
```

The webhook handler identifies payment types using:
- `m_payment_id` prefix: `sub_*` for subscriptions, `pay_*` for one-time
- `custom_str1`: `"tier_purchase"` or `"credit_pack"`
- `custom_str2`: tier name or pack size

## Key Files

### Backend
- `app/config.py` - PayFast credentials
- `app/services/payfast_service.py` - Signature generation, form creation
- `app/api/v1/endpoints/payments.py` - Payment endpoints
- `app/models/domain.py` - Payment request/response models

### Frontend
- `src/app/api/payments/subscribe/route.ts` - Subscribe API proxy
- `src/app/api/payments/credit-pack/route.ts` - Credit pack API proxy
- `src/app/api/payfast/notify/route.ts` - ITN webhook handler
- `src/app/api/subscription/route.ts` - Get subscription status API
- `src/app/upgrade/page.tsx` - Upgrade/subscription page
- `src/app/upgrade/UpgradeClient.tsx` - Tier selection UI
- `src/app/payment/success/page.tsx` - Payment success page
- `src/app/payment/cancel/page.tsx` - Payment cancelled page
- `src/components/AccountMenu.tsx` - Account dropdown with tier/credits
- `src/lib/subscription.ts` - Subscription utility functions
- `prisma/schema.prisma` - Subscription & CreditPurchase models

## Tier Enforcement
- `src/hooks/useSubscription.ts` - Client-side subscription state hook
- `src/app/api/subscription/usage/route.ts` - Reports usage and deducts credits
- `src/components/CreditsWarning.tsx` - Banner shown when credits low/exhausted

### Logic Flow
1. User makes AI request → check `hasCredits()` 
2. Request completes → call `reportUsage(tokens, imageGenerated)`
3. If `effectiveTier()` returns FREE (out of credits) → use FREE tier models
4. Show `CreditsWarning` component when `isLowCredits()` true

## Current Implementation Status

### ✅ COMPLETE
- Backend PayFast integration (10/10 tests passing)
- Frontend Account System (AccountMenu, upgrade page, subscription APIs)
- Payment Idempotency (ProcessedPayment model + ITN handler)
- Payment Failure Tracking (past_due status, retryCount)
- SUBSCRIPTION.md documentation with all 13 critical pieces

### ✅ COMPLETE - Critical Items
1. ✅ Monthly reset cron job (APScheduler) - `scheduler_service.py`
2. ✅ Backend usage enforcement - `subscription_service.py` + chat.py
3. ✅ PayFast cancellation API - `/api/subscription/cancel`
4. ✅ Payment idempotency (ProcessedPayment table)
5. ✅ Payment failure tracking (past_due, retryCount)

### ⏳ PENDING - Important
1. Email templates (EmailJS integration)
2. Admin subscription overrides panel
3. Credit expiry policy enforcement

## Schema Updates Applied
```prisma
model ProcessedPayment {
  id          String   @id @default(cuid())
  pfPaymentId String   @unique  // Unique for idempotency
  type        String   // "subscription" | "credit_pack"
  amount      Int      // cents
  userId      String
  processedAt DateTime @default(now())
}

model Subscription {
  // ... existing fields plus:
  paymentFailedAt DateTime?  // When payment last failed
  retryCount      Int @default(0)  // PayFast retry attempts
}

model CreditPurchase {
  // ... existing fields plus:
  expiresAt DateTime?  // Optional 12-month expiry
}
```