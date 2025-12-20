# Token Administration System

## Overview

Token Administration (Phases 14-18 from RAG_SYSTEM_DESIGN.md) implements dynamic pricing management for GOGGA's tiered AI services.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Admin Panel    │────▶│   SQLite DB     │◀────│    Frontend     │
│  (port 3100)    │     │  (Prisma 7)     │     │   (port 3000)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │ Pricing Service │
                        │ (5-min cache)   │
                        └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   Cost Tracker  │
                        │ (per-request)   │
                        └─────────────────┘
```

## Database Schema

Located in `gogga-frontend/prisma/schema.prisma` (shared with admin):

### ModelPricing
```prisma
model ModelPricing {
  id               String   @id @default(cuid())
  modelId          String   @unique
  displayName      String
  provider         String   // cerebras, openrouter, bfl
  inputPricePerM   Float    // USD per 1M input tokens
  outputPricePerM  Float    // USD per 1M output tokens
  imagePricePerUnit Float   // USD per image
  allowedTiers     String   // comma-separated: "free,jive,jigga"
  isActive         Boolean  @default(true)
}
```

### FeatureCost
```prisma
model FeatureCost {
  id             String   @id @default(cuid())
  featureKey     String   @unique  // rag_search, optillm_cot, image_gen
  displayName    String
  description    String?
  costType       String   // per_token, per_use, per_image
  costAmountUSD  Float    // base cost
  tierOverrides  String?  // JSON: {"free":1.1,"jive":1.3,"jigga":1.5}
  cepoMultiplier Float    @default(1.0)
  isBillable     Boolean  @default(true)
}
```

### ExchangeRate
```prisma
model ExchangeRate {
  id           String   @id @default(cuid())
  fromCurrency String   // USD
  toCurrency   String   // ZAR
  rate         Float    // 18.50
}
```

## API Endpoints

### Frontend APIs (port 3000)
- `GET /api/tokens/models` - List active models with pricing
- `GET /api/tokens/features` - List billable features
- `GET /api/tokens/exchange` - Get exchange rates

### Admin APIs (port 3100)
- `GET/PUT /api/tokens/models` - CRUD for model pricing
- `GET/PUT /api/tokens/features` - CRUD for feature costs
- `GET/PUT /api/tokens/exchange` - CRUD for exchange rates

## Backend Pricing Service

**File**: `gogga-backend/app/services/pricing_service.py`

### Key Functions
```python
# Get pricing for a specific model
pricing = await get_model_pricing("qwen-3-32b")

# Get exchange rate (USD -> ZAR)
rate = await get_exchange_rate()  # Returns 18.5

# Get models available for a tier
models = await get_model_pricing_by_tier("jive")

# Calculate cost
cost = calculate_cost_usd(
    input_tokens=1000,
    output_tokens=500,
    model_pricing=pricing,
    optillm_multiplier=1.3
)
```

### Caching
- 5-minute TTL cache for pricing data
- Falls back to `config.py` defaults if API unavailable
- Thread-safe with `asyncio.Lock()`
- SSL verification disabled for dev (self-signed certs)

## Cost Tracker

**File**: `gogga-backend/app/services/cost_tracker.py`

Tracks per-request costs with:
- Token counts (input/output)
- OptiLLM multipliers
- Image generation costs
- Feature usage

## Seeded Data

Run with: `cd gogga-admin && npx ts-node prisma/seed.ts`

**Models (5)**:
| Model ID | Provider | Input/1M | Output/1M | Image |
|----------|----------|----------|-----------|-------|
| qwen-3-32b | Cerebras | $0.10 | $0.10 | - |
| qwen-3-235b-a22b-instruct-2507 | OpenRouter | $0.80 | $1.10 | - |
| meta-llama/llama-3.3-70b-instruct | OpenRouter | $0.35 | $0.35 | - |
| flux-1.1-pro | BFL | - | - | $0.04 |
| pollinations-image | Pollinations | - | - | $0.00 |

**Features (5)**:
- rag_search (free)
- optillm_cot (billable, tier multipliers)
- image_gen ($0.04/image)
- chart_gen (free)
- math_tools (free)

**Exchange Rate**: USD → ZAR = 18.50

## Admin UI

**File**: `gogga-admin/src/app/tokens/page.tsx`

Tabbed interface with:
- **Models tab**: Edit input/output/image pricing, allowed tiers
- **Features tab**: Edit feature costs, tier overrides
- **Exchange tab**: Update ZAR/USD rate

Summary cards show:
- Active models count
- Billable features count
- Current exchange rate
- Cheapest model

## Testing

**Test file**: `gogga-backend/tests/test_pricing_service.py`

```bash
cd gogga-backend && pytest tests/test_pricing_service.py -v
# 17 passed, 1 skipped
```

Tests cover:
- Cache validity/expiration
- Model pricing retrieval
- Exchange rate fallback
- Cost calculations
- Feature cost lookup

## Configuration

### Environment Variables
```bash
# Frontend/Admin
DATABASE_URL="file:../gogga-frontend/prisma/dev.db"

# Backend
FRONTEND_URL="https://192.168.0.130:3000"  # For API fetching
```

### Important Notes

1. **Schema alignment**: Frontend and admin schemas MUST match exactly
2. **Prisma 7 adapter**: Both use `@prisma/adapter-better-sqlite3`
3. **Self-signed certs**: Pricing service disables SSL verify for dev URLs
4. **Cache invalidation**: Call `await invalidate_cache()` after pricing updates
5. **Port 3100 issue**: Sometimes stuck - use `fuser -k 3100/tcp` to clear

## Related Files

- `gogga-frontend/prisma/schema.prisma` - Database schema
- `gogga-admin/prisma/seed.ts` - Seed data script
- `gogga-admin/src/app/tokens/page.tsx` - Admin UI
- `gogga-backend/app/services/pricing_service.py` - Pricing cache
- `gogga-backend/app/services/cost_tracker.py` - Per-request tracking
- `gogga-backend/app/jobs/usage_reconciliation.py` - Hourly reconciliation
- `gogga-backend/tests/test_pricing_service.py` - Test suite
