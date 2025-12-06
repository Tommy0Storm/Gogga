# GOGGA Subscription & Payments

## Overview

GOGGA uses **PayFast** (South African payment gateway) for all subscription and payment processing. Payments are processed in ZAR (South African Rand).

---

## ⚠️ Implementation Status

| Component | Status | Priority |
|-----------|--------|----------|
| PayFast form generation | ✅ Done | - |
| ITN webhook handler | ✅ Done | - |
| Subscription database models | ✅ Done | - |
| Payment idempotency (ProcessedPayment) | ✅ Done | - |
| Payment failure tracking (past_due) | ✅ Done | - |
| Monthly reset cron job (APScheduler) | ✅ Done | - |
| Backend usage enforcement | ✅ Done | - |
| PayFast cancellation API | ✅ Done | - |
| ITN signature verification | ✅ Done | - |
| Subscription downgrade schedule | ✅ Done | - |
| Admin subscription overrides | ❌ TODO | Important |
| Credit expiration policy | ⚠️ Schema ready | Important |
| Email templates | ❌ TODO | Important |
| Usage analytics | ❌ TODO | Nice to have |

---

## Subscription Tiers

| Tier | Price | AI Model | Images | RAG Docs | Features |
|------|-------|----------|--------|----------|----------|
| **FREE** | R0 | Llama 3.3 70B (OpenRouter) | LongCat Flash | ❌ | Basic chat, no history |
| **JIVE** | R99/month | Llama 3.1 8B + CePO | 200/month (FLUX 1.1 Pro) | 5 docs | Chat history, RAG |
| **JIGGA** | R299/month | Qwen 3 32B (thinking mode) | 1000/month (FLUX 1.1 Pro) | 10 docs | Semantic RAG, cross-session docs |

### Monthly Credit Allowances
- **JIVE**: 500,000 credits/month
- **JIGGA**: 2,000,000 credits/month

---

## Credit Packs (Once-off Top-ups)

| Pack | Price | Credits |
|------|-------|---------|
| Small | R200 | 50,000 |
| Medium | R500 | 150,000 |
| Large | R1,000 | 350,000 |

**Note:** Credit packs are once-off purchases only. When users run out of credits, they revert to FREE tier behavior.

---

## PayFast Integration

### Sandbox Credentials (Testing)
```
Merchant ID: 10043379
Merchant Key: cv55nate9wgnf
Passphrase: gogga-testing
Sandbox URL: https://sandbox.payfast.co.za/eng/process
Sandbox Dashboard: https://sandbox.payfast.co.za/
Test Email: tommy@vcb-ai.online
```

---

## 🧪 Testing with Ngrok

### Setup Ngrok (Required for Local Testing)

PayFast cannot reach localhost, so we use ngrok to create a public tunnel.

```bash
# Install ngrok (Ubuntu)
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo gpg --dearmor -o /usr/share/keyrings/ngrok.gpg
echo "deb [signed-by=/usr/share/keyrings/ngrok.gpg] https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install -y ngrok

# Authenticate (get token from https://dashboard.ngrok.com/get-started/your-authtoken)
ngrok config add-authtoken YOUR_TOKEN_HERE

# Start tunnel to proxy port 3001
ngrok http https://192.168.0.168:3001
```

### Update APP_URL
After starting ngrok, update `gogga-backend/.env`:
```bash
APP_URL=https://your-random-subdomain.ngrok-free.dev
```

Then restart the backend:
```bash
docker compose up -d --force-recreate backend
```

### Monitor Ngrok Traffic
Open `http://localhost:4040` to see all requests through ngrok including ITN webhooks.

### Test Payment Flow

1. Navigate to: `https://your-ngrok-url.ngrok-free.dev/upgrade`
2. Click **Upgrade** on JIVE or JIGGA tier
3. Select payment type:
   - **Once-off Payment** - Single 30-day access
   - **Monthly Recurring** - Tokenization with programmatic billing
4. Complete payment on PayFast sandbox
5. PayFast redirects to `/payment/success`
6. ITN webhook fires to `/api/payfast/notify`

### PayFast Sandbox Test Cards
| Card Number | Result |
|-------------|--------|
| 4000 0000 0000 0002 | Successful payment |
| 4000 0000 0000 0036 | Declined |

Use any future expiry date and any 3-digit CVV.

---

## Payment Types

### subscription_type=1 (Auto-Billing)
- PayFast automatically charges the customer monthly
- Less control over billing schedule
- Used for standard subscriptions

### subscription_type=2 (Tokenization)
- PayFast stores the card, merchant charges via API
- Full control over when/how much to charge
- Used for "Monthly Recurring" option

**Tokenization Flow:**
1. User completes initial payment (card is tokenized)
2. PayFast sends ITN with `token` field
3. We store token in `RecurringSchedule` table
4. Cron job calls `POST /subscriptions/{token}/adhoc` monthly

### Adhoc Charge API (Tokenization)
```http
POST https://api.payfast.co.za/subscriptions/{token}/adhoc?testing=true
Headers:
  merchant-id: 10043379
  version: v1
  timestamp: 2025-12-06T14:30:00+02:00
  signature: {md5_signature}

{
  "amount": 9900,  // Amount in cents
  "item_name": "JIVE Monthly - December 2025"
}
```

### Signature Generation Rules
**CRITICAL**: For subscription forms, use **PayFast documentation field order** (NOT alphabetical!):
1. merchant_id, merchant_key
2. return_url, cancel_url, notify_url
3. email_address (buyer details)
4. m_payment_id, amount, item_name
5. subscription_type, billing_date, recurring_amount, frequency, cycles

**For API calls** (like cancel_subscription), use **alphabetical order**.

### General Signature Rules
1. Filter out empty values
2. URL encode with `quote_plus` (spaces become `+`, NOT `%20`)
3. Append passphrase at the end
4. MD5 hash the result

### Legacy Signature Generation Rules
1. Sort fields alphabetically
2. Filter out empty values
3. URL encode with `quote_plus` (spaces become `+`, NOT `%20`)
4. Append passphrase at the end
5. MD5 hash the result

---

## Backend API Endpoints

All endpoints are prefixed with `/api/v1/payments/`

### Subscribe to Tier
```http
POST /api/v1/payments/subscribe
Content-Type: application/json

{
  "email": "user@example.com",
  "tier": "JIVE" | "JIGGA",
  "payment_type": "subscription" | "once_off"
}
```

### Purchase Credit Pack
```http
POST /api/v1/payments/credit-pack
Content-Type: application/json

{
  "email": "user@example.com",
  "pack_size": 200 | 500 | 1000
}
```

### List Available Tiers
```http
GET /api/v1/payments/tiers
```

### List Credit Packs
```http
GET /api/v1/payments/credit-packs
```

### Cancel Subscription
```http
POST /api/v1/payments/cancel/{subscription_token}
```

### ITN Webhook (PayFast Callback)
```http
POST /api/v1/payments/notify
```
PayFast sends POST data with payment status. Handler identifies payment type via:
- `custom_str1`: `"subscription"` or `"credit_pack"`
- `custom_str2`: tier name or pack price

---

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/upgrade` | Tier selection and subscription page |
| `/payment/success` | Shown after successful payment |
| `/payment/cancel` | Shown when payment is cancelled |

### Frontend API Routes (Next.js)
| Route | Purpose |
|-------|---------|
| `/api/payments/subscribe` | Proxies to backend subscribe endpoint |
| `/api/payments/credit-pack` | Proxies to backend credit pack endpoint |
| `/api/payfast/notify` | ITN webhook handler (updates database) |
| `/api/subscription` | Returns current user's subscription status |
| `/api/subscription/usage` | Reports token/image usage, deducts credits |
| `/api/internal/subscription-activate` | **Dev only**: Manual subscription activation |

---

## Subscription Upgrade Workflow

Complete flow from upgrade page to chat interface:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UPGRADE PAGE → CHAT FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER: Clicks "Upgrade to JIVE/JIGGA" on /upgrade                        │
│     └── UpgradeClient.tsx → handleSubscribe(tier)                           │
│                                                                              │
│  2. FRONTEND: POST /api/payments/subscribe                                  │
│     Body: { email, tier: "jive" }                                           │
│     └── src/app/api/payments/subscribe/route.ts                             │
│                                                                              │
│  3. BACKEND: POST /api/v1/payments/subscribe                                │
│     └── app/api/v1/endpoints/payments.py                                    │
│     └── payfast_service.generate_subscription_form()                        │
│     Returns: { action, fields: { merchant_id, signature, ... } }            │
│                                                                              │
│  4. FRONTEND: Creates hidden form, auto-submits to PayFast                  │
│     └── Form action: https://sandbox.payfast.co.za/eng/process              │
│     └── User sees PayFast payment page                                      │
│                                                                              │
│  5. USER: Completes payment on PayFast                                      │
│     └── Enters card details, confirms payment                               │
│                                                                              │
│  6. PAYFAST: Sends ITN (webhook) to backend                                 │
│     POST /api/v1/payments/notify                                            │
│     └── Verifies signature, updates subscription in DB                      │
│     ⚠️ In local dev, ITN can't reach localhost - use manual activation      │
│                                                                              │
│  7. PAYFAST: Redirects user to return_url                                   │
│     └── APP_URL/payment/success                                             │
│                                                                              │
│  8. SUCCESS PAGE: Fetches fresh subscription data                           │
│     GET /api/subscription                                                   │
│     └── Shows tier badge, credits, image quota                              │
│     └── src/app/payment/success/page.tsx                                    │
│                                                                              │
│  9. USER: Clicks "Back to Chat"                                             │
│     └── Navigates to / (main chat)                                          │
│     └── useSubscription hook reads from session + DB                        │
│     └── Tier-specific models now available                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Local Development Testing

Since PayFast ITN can't reach local development servers:

```bash
# After completing PayFast payment, manually activate subscription:
curl -X POST http://localhost:3000/api/internal/subscription-activate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-internal-key-change-in-production" \
  -d '{"email": "user@example.com", "tier": "JIVE"}'

# Response:
# {"success": true, "subscription": {"tier": "JIVE", "status": "active", ...}}
```

### Key Environment Variables (Backend)

```bash
# Required for payment return redirects
APP_URL=http://192.168.0.168:3001   # Frontend URL (port 3001 via proxy)
API_URL=http://192.168.0.168:8000   # Backend URL

# PayFast Sandbox
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=jt7NOE43FZPn     # REQUIRED for subscriptions!
PAYFAST_ENV=sandbox
```

---

## Key Components

### AccountMenu (`src/components/AccountMenu.tsx`)
Dropdown in header showing:
- User email
- Current tier badge
- Credits remaining (paid tiers)
- Images used/limit
- Upgrade button
- Buy credits button
- Sign out

### CreditsWarning (`src/components/CreditsWarning.tsx`)
Banner shown when:
- **Low credits**: < 10% remaining
- **Out of credits**: User reverts to FREE tier

### useSubscription Hook (`src/hooks/useSubscription.ts`)
```typescript
const {
  tier,           // Current tier
  credits,        // Credit breakdown
  images,         // Image usage
  hasCredits,     // Check if can make request
  canGenerateImage, // Check if can generate image
  effectiveTier,  // Actual tier (FREE if out of credits)
  isLowCredits,   // Warning threshold
  reportUsage,    // Report tokens used
  refresh,        // Refresh subscription data
} = useSubscription()
```

---

## Database Schema (Prisma)

### Subscription Model
```prisma
model Subscription {
  id            String    @id @default(cuid())
  userId        String    @unique
  tier          String    @default("FREE")
  status        String    @default("pending")
  payfastToken  String?
  startedAt     DateTime?
  nextBilling   DateTime?
  credits       Int       @default(0)      // Purchased credits
  creditsUsed   Int       @default(0)      // Total used
  monthlyCredits Int      @default(0)      // From subscription
  imagesUsed    Int       @default(0)
  imagesLimit   Int       @default(0)
  lastReset     DateTime?
  user          User      @relation(...)
}
```

### CreditPurchase Model
```prisma
model CreditPurchase {
  id          String   @id @default(cuid())
  userId      String
  packSize    String   // "200", "500", "1000"
  credits     Int      // Credits granted
  pfPaymentId String?  // PayFast payment ID
  status      String   // pending, complete, failed
  createdAt   DateTime @default(now())
}
```

---

## Tier Enforcement Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Makes AI Request                        │
├─────────────────────────────────────────────────────────────────┤
│  1. useSubscription.hasCredits() → Check if credits available   │
│  2. If NO credits → Show CreditsWarning, use FREE tier models   │
│  3. If YES → Make request with paid tier models                 │
├─────────────────────────────────────────────────────────────────┤
│                     Request Completes                            │
├─────────────────────────────────────────────────────────────────┤
│  4. reportUsage(tokensUsed, imageGenerated)                     │
│  5. Backend deducts from credits, updates database              │
│  6. If isLowCredits() → Show warning banner                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Reference

### Backend (gogga-backend/)
| File | Purpose |
|------|---------|
| `app/config.py` | PayFast credentials |
| `app/models/domain.py` | PaymentType, CreditPackSize enums |
| `app/services/payfast_service.py` | Signature generation, form creation |
| `app/api/v1/endpoints/payments.py` | All payment endpoints |

### Frontend (gogga-frontend/)
| File | Purpose |
|------|---------|
| `src/app/upgrade/page.tsx` | Server component with auth |
| `src/app/upgrade/UpgradeClient.tsx` | Tier selection UI |
| `src/app/payment/success/page.tsx` | Success confirmation |
| `src/app/payment/cancel/page.tsx` | Cancellation page |
| `src/components/AccountMenu.tsx` | Account dropdown |
| `src/components/CreditsWarning.tsx` | Low credits banner |
| `src/hooks/useSubscription.ts` | Subscription state hook |
| `src/lib/subscription.ts` | Utility functions |
| `prisma/schema.prisma` | Database models |

---

## Testing

### Backend Tests
```bash
cd gogga-backend && pytest tests/test_payments.py -v
```
All 10 tests should pass:
- Signature generation
- Form field validation
- ITN verification

### Manual Testing
1. Go to `/upgrade`
2. Select JIVE or JIGGA
3. Redirects to PayFast sandbox
4. Use test card: `4000 0000 0000 0000`
5. Completes → redirects to `/payment/success`
6. Check database for subscription record

---

## 🚨 CRITICAL: Monthly Reset Cron Job

**Without this, the entire payment system collapses on Month 2.**

### What Must Reset Monthly
- `monthlyCredits` → restore to tier allowance
- `creditsUsed` → reset to 0
- `imagesUsed` → reset to 0
- `nextBilling` → add 30 days
- `lastReset` → update to now

### Daily Cron Logic
```python
# Run daily at 00:05 UTC
async def daily_subscription_check():
    subscriptions = await get_due_subscriptions()
    
    for sub in subscriptions:
        if sub.nextBilling <= today:
            if sub.status == 'active':
                # Reset credits and images
                sub.monthlyCredits = TIER_CREDITS[sub.tier]
                sub.creditsUsed = 0
                sub.imagesUsed = 0
                sub.imagesLimit = TIER_IMAGES[sub.tier]
                sub.nextBilling = sub.nextBilling + timedelta(days=30)
                sub.lastReset = datetime.now()
                
            elif sub.status == 'cancelled':
                # Grace period over - revert to FREE
                sub.tier = 'FREE'
                sub.monthlyCredits = 0
                sub.imagesLimit = 0
                sub.status = 'expired'
                
            elif sub.status == 'past_due':
                # Payment failed - check retry count
                if sub.retryCount >= 3:
                    sub.status = 'cancelled'
                    # Send cancellation email
```

### Implementation Options
1. **APScheduler** (simplest for FastAPI)
2. **Celery Beat** (if scaling)
3. **systemd timer** (Linux native)
4. **Cloud Functions** (if on Azure/GCP)

### Recommended: APScheduler
```python
# app/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=0, minute=5)
async def monthly_reset_job():
    await process_subscription_resets()

# Start in main.py lifespan
scheduler.start()
```

---

## 🚨 CRITICAL: Payment Idempotency

**PayFast sends ITN multiple times. Without idempotency, users get double credits.**

### Problem
- PayFast retries ITN on network issues
- Malicious users can replay ITN packets
- Result: Infinite credits exploit

### Solution: ProcessedPayment Table
```prisma
model ProcessedPayment {
  id          String   @id @default(cuid())
  pfPaymentId String   @unique  // PayFast payment ID
  type        String   // "subscription" | "credit_pack"
  amount      Int
  processedAt DateTime @default(now())
  userId      String
}
```

### ITN Handler Update
```typescript
// Before processing ANY payment:
const existing = await prisma.processedPayment.findUnique({
  where: { pfPaymentId: data.pf_payment_id }
})

if (existing) {
  console.log('Duplicate ITN ignored:', data.pf_payment_id)
  return new NextResponse('OK', { status: 200 })
}

// Process payment...

// Record as processed
await prisma.processedPayment.create({
  data: {
    pfPaymentId: data.pf_payment_id,
    type: paymentType,
    amount: parseInt(data.amount_gross),
    userId: user.id,
  }
})
```

---

## 🚨 CRITICAL: Backend Usage Enforcement

**Frontend enforcement is bypassable. Backend MUST enforce tier limits.**

### Current Problem
```
Frontend: useSubscription.hasCredits() → blocks UI
Backend: No check → processes request anyway
```

### Required Backend Check
```python
# app/api/v1/endpoints/chat.py

async def chat(request: ChatRequest):
    user = await get_current_user()
    subscription = await get_subscription(user.id)
    
    # Determine effective tier
    effective_tier = get_effective_tier(subscription)
    
    if effective_tier == 'FREE' and request.user_tier != 'free':
        raise HTTPException(
            status_code=403,
            detail="Credits exhausted. Purchase more or upgrade."
        )
    
    # Process with effective_tier, not request.user_tier
    response = await ai_service.chat(
        message=request.message,
        tier=effective_tier,  # NOT request.user_tier
        ...
    )
```

### Effective Tier Logic
```python
def get_effective_tier(subscription) -> str:
    # Cancelled/expired = always FREE
    if subscription.status not in ('active', 'past_due'):
        return 'FREE'
    
    # Out of credits = FREE behavior (but keeps tier identity)
    total_credits = subscription.credits + subscription.monthlyCredits
    available = total_credits - subscription.creditsUsed
    
    if available <= 0:
        return 'FREE'
    
    return subscription.tier
```

---

## 🚨 CRITICAL: PayFast Subscription Cancellation

**PayFast does NOT auto-cancel. You must call their API.**

### Current Problem
- DB flip to `cancelled` doesn't stop PayFast billing
- User keeps getting charged
- Refund nightmare

### PayFast Cancellation API
```python
async def cancel_payfast_subscription(token: str) -> bool:
    """Cancel recurring subscription via PayFast API"""
    
    headers = {
        'merchant-id': settings.PAYFAST_MERCHANT_ID,
        'version': 'v1',
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }
    
    # Generate signature for API call
    signature = generate_api_signature(headers)
    headers['signature'] = signature
    
    url = f"https://api.payfast.co.za/subscriptions/{token}/cancel"
    
    async with httpx.AsyncClient() as client:
        response = await client.put(url, headers=headers)
        
    if response.status_code == 200:
        return True
    else:
        logger.error(f"PayFast cancel failed: {response.text}")
        return False
```

### Cancellation Flow
```
1. User clicks "Cancel Subscription"
2. Backend calls PayFast API to cancel recurring
3. If success → update DB status = 'cancelled'
4. User keeps access until nextBilling date
5. Daily cron reverts to FREE after nextBilling
```

---

## 🚨 CRITICAL: ITN Signature Verification

### Full Verification Checklist
```typescript
async function verifyITN(data: Record<string, string>, request: NextRequest): boolean {
  // 1. IP Whitelist Check
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
  if (!PAYFAST_IPS.includes(clientIp)) {
    console.error('Invalid IP:', clientIp)
    return false
  }
  
  // 2. Merchant ID Validation
  if (data.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
    console.error('Invalid merchant ID')
    return false
  }
  
  // 3. Amount Validation (compare to expected)
  const expectedAmount = await getExpectedAmount(data.m_payment_id)
  if (parseFloat(data.amount_gross) !== expectedAmount) {
    console.error('Amount mismatch')
    return false
  }
  
  // 4. Signature Verification
  const isValidSignature = verifyPayFastSignature(data)
  if (!isValidSignature) {
    console.error('Invalid signature')
    return false
  }
  
  // 5. Payment Status Check
  if (data.payment_status !== 'COMPLETE') {
    console.log('Payment not complete:', data.payment_status)
    return false
  }
  
  return true
}
```

---

## 🚨 CRITICAL: Subscription Downgrade Schedule

### Payment Failure Flow
```
Day 0: Payment fails → status = 'past_due'
Day 1: PayFast retry #1
Day 3: PayFast retry #2
Day 7: PayFast retry #3
Day 8: If still failed → status = 'cancelled'
Day 8+: User has access until nextBilling
After nextBilling: tier = 'FREE', status = 'expired'
```

### Database Fields Needed
```prisma
model Subscription {
  // ... existing fields
  status        String    // pending, active, past_due, cancelled, expired
  paymentFailedAt DateTime?
  retryCount    Int       @default(0)
}
```

### ITN Handler for Failed Payments
```typescript
case 'FAILED':
  await prisma.subscription.update({
    where: { userId: user.id },
    data: {
      status: 'past_due',
      paymentFailedAt: new Date(),
      retryCount: { increment: 1 },
    }
  })
  
  // Send payment failed email
  await sendEmail('payment_failed', userEmail)
  break
```

---

## Important: Tier vs Behavior Distinction

### Key Rule
> **Users keep their TIER identity even with 0 credits.**
> **They only lose tier BEHAVIOR (paid models).**

### Correct Logic
| Situation | Tier | Effective Behavior |
|-----------|------|-------------------|
| JIVE, 100K credits | JIVE | JIVE (Cerebras) |
| JIVE, 0 credits | JIVE | FREE (OpenRouter) |
| JIGGA, cancelled, within grace | JIGGA | JIGGA |
| JIGGA, cancelled, past grace | FREE | FREE |

### Why This Matters
- UI still shows "JIVE" badge
- Chat history still works
- RAG still works (just slower models)
- User is incentivized to top up, not abandoned

---

## Important: Credit Expiration Policy

### Decision Required
| Policy | Pros | Cons |
|--------|------|------|
| Never expire | Simple, user-friendly | Liability on books |
| Expire after 12 months | Standard practice | Needs tracking |
| Expire on cancel | Forces commitment | Angry users |

### Recommended: 12-Month Expiry
```prisma
model CreditPurchase {
  // ... existing fields
  expiresAt   DateTime  // createdAt + 12 months
}
```

### Credit Usage Priority
1. Use oldest credits first (FIFO)
2. Monthly credits before purchased
3. Track expiry separately

---

## Important: Admin Subscription Overrides

### Admin Panel Features Needed
```
/dashboard/admin/subscriptions
├── Search by email
├── View subscription details
├── Override tier (give free JIGGA)
├── Add credits (bug recovery)
├── Force cancel
├── Force reactivate
├── View payment history
└── View usage logs
```

### Admin API Endpoints
```http
POST /api/admin/subscriptions/{userId}/override
{
  "tier": "JIGGA",
  "credits": 100000,
  "reason": "Beta tester reward"
}

POST /api/admin/subscriptions/{userId}/cancel
POST /api/admin/subscriptions/{userId}/reactivate
```

---

## Important: Email Templates

### Required Templates
| Event | Template | When |
|-------|----------|------|
| `subscription_activated` | Welcome + tier benefits | After first payment |
| `payment_failed` | Action required | On ITN FAILED |
| `payment_retry` | Retry scheduled | Day 1, 3, 7 |
| `subscription_cancelled` | Goodbye + data retention | On cancel |
| `credits_low` | Top up reminder | < 10% remaining |
| `credits_exhausted` | Downgrade notice | 0 credits |
| `renewal_reminder` | Upcoming charge | 3 days before |
| `credit_pack_purchased` | Receipt | On credit pack ITN |

### Email Service
Use existing EmailJS integration or add:
- Postmark (transactional)
- Resend (developer-friendly)
- AWS SES (cheap at scale)

---

## Nice to Have: Rate Limiting

### Credit Pack Spam Protection
```python
# Max 3 credit pack purchases per hour per user
@rate_limit(limit=3, window=3600)
async def purchase_credit_pack(request):
    ...
```

### ITN Replay Protection
- Unique constraint on `pfPaymentId` (covered above)
- Log all ITN attempts
- Alert on suspicious patterns

---

## Nice to Have: Usage Analytics

### Track in Database
```prisma
model UsageLog {
  id          String   @id @default(cuid())
  userId      String
  tier        String
  tokensUsed  Int
  model       String
  latencyMs   Int
  createdAt   DateTime @default(now())
}
```

### Dashboard Metrics
- Daily/weekly/monthly usage
- Cost per user
- Most expensive queries
- Tier distribution
- Churn rate
