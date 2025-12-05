# CePO (Cerebras Planning Optimization) Configuration

## Overview
CePO is an advanced reasoning system using OptiLLM with Cerebras Inference API.
It provides enhanced chain-of-thought planning and reasoning capabilities.

## Current Status (Dec 3, 2025)

### JIVE Configuration Confirmed
**JIVE tier uses `llama3.3-70b` for ALL Cerebras calls via OptiLLM CePO:**

| Layer | Model | Speed | Config |
|-------|-------|-------|--------|
| JIVE_SPEED | `llama3.3-70b` | 2,200 tokens/s | CePO, max_tokens=4096 |
| JIVE_REASONING | `llama3.3-70b` | 2,200 tokens/s | CePO, max_tokens=8000 (extended) |

### Token Limits (Dec 2025)
| Mode | Max Tokens | Trigger |
|------|------------|---------|
| Standard | 4,096 | Default casual chat |
| Extended | 8,000 | Reports, analysis, documents, "detailed", "comprehensive" |
| Model Max | 40,000 | Available when ready (cost-controlled) |

**Extended Output Keywords:** (router.py `EXTENDED_OUTPUT_KEYWORDS`)
- "detailed report", "comprehensive analysis", "full breakdown"
- "long format", "extended analysis", "thorough review"
- "in-depth", "professional document", "formal document"
- "draft a", "complete analysis", "full explanation"

**Files:**
- `router.py`: `is_extended_output_request()`, `JIVE_MAX_TOKENS=8000`, `JIVE_DEFAULT_TOKENS=4096`
- `ai_service.py`: Detects extended requests, passes max_tokens to CePO
- `cepo_service.py`: `generate_with_cepo(max_tokens=4096)` accepts dynamic max_tokens

## Cerebras Inference Models for CePO

| Model | Speed | Use Case |
|-------|-------|----------|
| `llama3.3-70b` | **2,000 reasoning tokens/s** | CePO recommended model |
| `llama3.1-8b` | ~2,200 t/s | Fast reasoning |
| `qwen-3-235b-a22b-instruct-2507` | ~1,400 t/s | Deep reasoning |

**Note:** CePO is implemented using Cerebras inference, which currently supports `llama3.3-70b` at 2,200 reasoning tokens/s.

## Setup Steps
1. Install/upgrade packages:
```bash
pip install --upgrade cerebras_cloud_sdk 
pip install --upgrade optillm
```

2. Export API key:
```bash
export CEREBRAS_API_KEY='your_api_key_here'
```

3. Run OptiLLM with CePO:
```bash
optillm --base-url https://api.cerebras.ai --approach cepo
```

## Docker Configuration
The CePO sidecar is defined in `docker-compose.yml` using `gogga-cepo/Dockerfile`.

**Current Dockerfile** (needs fix for reasoning_effort issue):
```dockerfile
FROM python:3.12-slim
RUN pip install --no-cache-dir --upgrade cerebras_cloud_sdk optillm math_verify
CMD ["optillm", "--base-url", "https://api.cerebras.ai", "--approach", "cepo", "--port", "8080"]
```

## Test Commands
```bash
# Health check
curl -s http://localhost:8080/health

# Direct Cerebras API test (works)
curl -s -X POST https://api.cerebras.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CEREBRAS_API_KEY" \
  -d '{
    "model": "llama3.3-70b",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7
  }'
```

## Integration Points
- Backend service: `app/services/cepo_service.py`
- Router: `app/core/router.py` (uses CePO for JIVE reasoning layer)
- Prompts: `app/prompts.py` (CEPO_IDENTITY_PROMPT for CePO mode)