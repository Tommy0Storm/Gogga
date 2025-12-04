# CePO (Cerebras Planning Optimization) Configuration

## Overview
CePO is an advanced reasoning system using OptiLLM with Cerebras Inference API.
It provides enhanced chain-of-thought planning and reasoning capabilities.

## Current Status (Dec 3, 2025)

### JIVE Configuration Confirmed
**JIVE tier now ONLY uses `llama3.3-70b` for ALL Cerebras calls:**

| Layer | Model | Speed | Config |
|-------|-------|-------|--------|
| JIVE_SPEED | `llama3.3-70b` | 2,000 tokens/s | Direct API, max_tokens=2000 |
| JIVE_REASONING | `llama3.3-70b` | 2,000 tokens/s | Direct API, max_tokens=2000 |

**Key Settings in router.py:**
- `model: settings.MODEL_CEPO` (llama3.3-70b)
- `use_cepo: False` (direct Cerebras API, bypasses OptiLLM)
- `append_no_think: False`

### OptiLLM CePO Issue (Fixed by Bypassing)
The OptiLLM CePO approach adds `reasoning_effort` parameter which Cerebras doesn't support.
**Solution:** Use direct Cerebras API calls instead of OptiLLM CePO.

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