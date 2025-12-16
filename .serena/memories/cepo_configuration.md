# CePO Configuration - RE-IMPLEMENTED (June 2025)

## Status (June 2025)
✅ **RE-IMPLEMENTED**: CePO sidecar restored for JIVE/JIGGA tiers with automatic failsafe.

### Architecture
- CePO container (`gogga-cepo/`) runs OptiLLM proxy with `--approach cepo`
- Routes JIVE/JIGGA requests through 4-step reasoning pipeline
- Automatic failsafe to direct Cerebras API on CePO failure
- OptiLLM enhancements (`optillm_enhancements.py`) still apply as fallback

### Files
| File | Purpose |
|------|---------|
| `gogga-cepo/Dockerfile` | OptiLLM CePO container (Python 3.12-slim) |
| `gogga-cepo/entrypoint.sh` | Startup script with CePO parameters |
| `gogga-cepo/cepo_config.yaml` | Best of N, Planning configuration |
| `app/services/cepo_service.py` | Service with async HTTPX client + failsafe |
| `app/config.py` | CEPO_ENABLED, CEPO_BASE_URL, CEPO_TIMEOUT settings |

### 4-Step CePO Pipeline
1. **Plan Generation** (temp=0.55) → Initial reasoning plan
2. **Initial Solution** (temp=0.25) → First implementation attempt  
3. **Plan Refinement** (temp=0.1) → Improve based on solution
4. **Final Solution** (temp=0.0) → Deterministic final output

### Best of N Selection
- Generates N=3 candidate responses in parallel
- Uses absolute scoring to select best output
- +10-20% accuracy improvement on reasoning tasks

### Configuration (app/config.py)
```python
CEPO_ENABLED: bool = True
CEPO_BASE_URL: str = "http://cepo:8080"
CEPO_TIMEOUT: float = 120.0
CEPO_BESTOFN_N: int = 3
```

### Docker Compose Service
```yaml
cepo:
  build: ./gogga-cepo
  container_name: gogga_cepo
  ports: ["8080:8080"]
  env_file: ./gogga-backend/.env
  environment:
    OPTILLM_APPROACH: "cepo"
    CEPO_BESTOFN_N: "3"
    CEPO_USE_REASONING_FALLBACK: "true"
```

### Routing Logic (ai_service.py)
- CePO enabled for JIVE/JIGGA tiers when `settings.CEPO_ENABLED=True`
- CePO disabled when tool calling is needed (not supported yet)
- On CePO failure → Falls back to direct Cerebras + optillm_enhancements

## Legacy Reference (Dec 3, 2025)

### JIVE Configuration Confirmed
**JIVE tier uses `llama3.3-70b` for ALL Cerebras calls via OptiLLM CePO:**

| Layer | Model | Speed | Config |
|-------|-------|-------|--------|
| JIVE_SPEED | `llama3.3-70b` | 2,200 tokens/s | CePO, max_tokens=4096 |
| JIVE_REASONING | `llama3.3-70b` | 2,200 tokens/s | CePO, max_tokens=8000 (extended) |

### Token Limits (Dec 2025)

**JIVE (Llama 3.3 70B via CePO)**
| Mode | Max Tokens | Trigger |
|------|------------|---------|
| Standard | 4,096 | Default casual chat |
| Extended | 8,000 | Reports, analysis, documents |
| Model Max | 40,000 | Available when ready (cost-controlled) |

**JIGGA (Qwen 3 32B)**
| Mode | Max Tokens | Trigger |
|------|------------|---------|
| Standard | 4,096 | Default casual chat |
| Extended | 8,000 | Reports, analysis, documents |
| Context | 131,000 | Full context window |

**Long Context Tip:** For >100k context, use `/no_think` to save context budget.

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