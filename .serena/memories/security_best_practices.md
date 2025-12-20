# GOGGA Security Best Practices

## Overview (Updated Dec 2025)

This document captures security patterns, known vulnerabilities, and remediation guidelines for the GOGGA platform.

---

## Authentication Architecture

### NextAuth v5 Passwordless Flow
```
1. User enters email → POST /api/auth/request-token
2. Server generates 32-byte hex token → 15 min expiry
3. Token stored in LoginToken table + sent via EmailJS
4. User clicks magic link or pastes token
5. Credentials provider validates token
6. JWT created (30-day lifetime) → stored in cookie
```

### Session Security

| Setting | Current | Recommended | Notes |
|---------|---------|-------------|-------|
| Session Lifetime | 30 days | 7 days | Reduce attack window |
| Token Storage | JWT in cookie | Same | HttpOnly, Secure |
| Refresh Strategy | None | Sliding window | Auto-refresh on activity |

---

## API Security Patterns

### ✅ Correct Patterns (Already Implemented)

```python
# Lazy singleton HTTP clients (prevents connection leaks)
_client: httpx.AsyncClient | None = None
async def _get_client(self) -> httpx.AsyncClient:
    if self._client is None or self._client.is_closed:
        self._client = httpx.AsyncClient(timeout=120.0)
    return self._client

# Exponential backoff with jitter (prevents thundering herd)
def get_delay_ms(self, attempt: int) -> int:
    base_delay = self.initial_delay_ms * (self.multiplier ** attempt)
    capped_delay = min(base_delay, self.max_delay_ms)
    jitter = random.randint(0, self.jitter_max_ms)
    return int(capped_delay + jitter)

# API key hashing for storage
def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()
```

### ❌ Anti-Patterns (Must Fix)

```python
# NEVER: Accept any non-empty string as valid API key
async def validate_api_key(api_key: str) -> str:
    if not api_key:
        raise HTTPException(status_code=401)
    return api_key  # NO VALIDATION!

# NEVER: Trust tier from client header
if x_user_tier:
    return UserTier(x_user_tier.lower())  # BYPASS!

# NEVER: Base64 for tokens (no signature)
token_data = json.dumps(to_encode, default=str)
return base64.urlsafe_b64encode(token_data.encode()).decode()
```

---

## Tier Enforcement

### Server-Side Validation (Required)

```python
# CORRECT: Verify subscription via database
effective_tier = request.user_tier
if request.user_email and request.user_tier != UserTier.FREE:
    sub_status = await subscription_service.verify_subscription(
        user_email=request.user_email,
        requested_tier=request.user_tier,
    )
    effective_tier = sub_status.effective_tier  # Trust THIS, not request
```

### NEVER Trust Client Headers

```python
# ❌ DELETE this pattern from router.py
async def get_current_user_tier(
    x_user_tier: Optional[str] = Header(default=None),
) -> UserTier:
    if x_user_tier:
        return UserTier(x_user_tier.lower())  # ATTACKER CONTROLLED!
```

---

## Payment Security (PayFast)

### ITN Verification Checklist

| Check | Status | Code Location |
|-------|--------|---------------|
| Signature validation | ✅ Enabled | `payfast_service.py` |
| IP whitelist | ❌ **DISABLED** | `payments.py` line 145 |
| Idempotency (pf_payment_id) | ✅ Enabled | ProcessedPayment model |
| Amount validation | ✅ Enabled | Verify matches expected |

### Enable IP Verification

```python
# UNCOMMENT in payments.py
if not await payfast_service.verify_itn_source(client_ip):
    logger.warning(f"⚠️ ITN from invalid IP: {client_ip}")
    raise HTTPException(status_code=403, detail="Invalid source")
```

---

## Input Validation

### Tool Execution Safety

```python
# CURRENT: No validation on tool arguments
result = await execute_generate_image(
    prompt=request.arguments.get("prompt", ""),  # Unsanitized!
)

# REQUIRED: Validate and sanitize
from pydantic import BaseModel, validator

class ImageToolArgs(BaseModel):
    prompt: str
    
    @validator('prompt')
    def sanitize_prompt(cls, v):
        # Remove script tags, limit length, etc.
        v = v[:2000]  # Max length
        v = re.sub(r'<script.*?</script>', '', v, flags=re.DOTALL)
        return v
```

### Python Sandbox Restrictions

```python
# CURRENT: __import__ allowed in builtins (escape risk)
_SAFE_BUILTINS = {
    "__import__": __builtins__.__import__,  # DANGEROUS!
    # ...
}

# FIXED: Remove import capability
_SAFE_BUILTINS = {
    # Remove __import__ entirely
    "abs": abs,
    "len": len,
    # ... other safe builtins only
}
```

---

## Secrets Management

### Environment Variables (Required)

```bash
# .env MUST be in .gitignore
echo ".env" >> .gitignore

# Required secrets (fail fast if missing)
CEREBRAS_API_KEY=     # REQUIRED
OPENROUTER_API_KEY=   # REQUIRED
SECRET_KEY=           # REQUIRED (no default!)
ADMIN_SECRET=         # REQUIRED for admin endpoints
```

### Key Rotation

| Key Type | Rotation Frequency | Automation |
|----------|-------------------|------------|
| Cerebras API Keys | On compromise | Manual via admin |
| JWT Secret | Quarterly | Manual + session invalidation |
| PayFast Credentials | Annually | Manual |
| Internal API Keys | Monthly | Should automate |

---

## POPIA Compliance (South African Data Protection)

### Required Implementations

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Data minimization | ⚠️ | Audit what's stored |
| Consent at signup | ❌ | Add consent checkbox + record |
| Right to access | ❌ | GET /api/user/data-export |
| Right to deletion | ❌ | DELETE /api/user/delete-all |
| Data retention | ❌ | Auto-purge old logs/tokens |
| Breach notification | ❌ | Process documentation |

### Retention Policy Defaults

```python
RETENTION_POLICY = {
    "login_tokens": "24 hours",      # Cleanup expired tokens
    "auth_logs": "90 days",          # Connection audit trail
    "chat_messages": "user_controlled",  # RxDB client-side
    "processed_payments": "7 years",  # Legal requirement
    "usage_metrics": "30 days",
}
```

---

## Rate Limiting

### Required Endpoints

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| `/api/auth/request-token` | 5 | 15 min | Per email |
| `/api/v1/chat` | 60 | 1 min | Per user |
| `/api/v1/images/generate` | 10 | 1 min | Per user |
| `/api/v1/admin/*` | 30 | 1 min | Per IP |

### Implementation (Upstash Rate Limit)

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
});

export async function POST(request: NextRequest) {
  const email = (await request.json()).email;
  const { success, remaining } = await ratelimit.limit(`auth:${email}`);
  
  if (!success) {
    return NextResponse.json(
      { ok: false, message: 'Too many requests' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }
  // Continue...
}
```

---

## CORS Configuration

### Production Settings

```python
# main.py - REMOVE localhost in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # ❌ REMOVE in production
        # "http://localhost:3000",
        # "http://localhost:3100",
        
        # ✅ Production only
        "https://gogga.app",
        "https://www.gogga.app",
        "https://admin.gogga.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

## Audit Trail

### Required Logging

```python
# Security events to log
logger.info("Login success: user=%s, ip=%s", user_id, client_ip)
logger.warning("Login failed: email=%s, reason=%s, ip=%s", email, reason, ip)
logger.warning("Rate limit hit: endpoint=%s, identifier=%s", path, identifier)
logger.error("Signature validation failed: payment=%s", pf_payment_id)
logger.critical("Admin access attempt: unauthorized, ip=%s", client_ip)
```

### Sensitive Data Masking

```python
def mask_key(key: str) -> str:
    """Show only first 8 and last 4 characters."""
    if len(key) <= 12:
        return "***"
    return f"{key[:8]}...{key[-4:]}"

# Usage
logger.info("Using API key: %s", mask_key(api_key))
# Output: "Using API key: csk-kv8j...p4y5"
```

---

## Security Checklist for PRs

- [ ] No hardcoded secrets or API keys
- [ ] All user input validated with Pydantic
- [ ] Database queries use parameterized statements
- [ ] New endpoints have authentication
- [ ] Rate limiting on public endpoints
- [ ] Sensitive operations logged
- [ ] No sensitive data in error messages
- [ ] CORS origins appropriate for environment
