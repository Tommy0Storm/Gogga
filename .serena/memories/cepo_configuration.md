# CePO Configuration - ACTIVE (Dec 2025)

## Status (Dec 2025)
✅ **ACTIVE**: CePO sidecar is running with OptiLLM v0.3.11 for JIVE/JIGGA tier enhanced reasoning.

### Container
- **Image**: `ghcr.io/algorithmicsuperintelligence/optillm:latest-proxy`
- **Port**: 8080 (host) → 8000 (container)
- **Health**: http://localhost:8080/health

## ⚠️ CRITICAL: Cerebras Compatibility

**Cerebras API does NOT support**:
- `reasoning_effort` parameter (used by `cepo` approach) → **422 error**
- `n > 1` parameter (used by `bon` approach) → **422 error**

**Cerebras-Compatible Approaches**:
- ✅ `re2` - ReRead (processes query twice for better understanding)
- ✅ `cot_reflection` - Chain of Thought with `<thinking>`, `<reflection>`, `<output>` sections
- ✅ `plansearch` - Plan before solving
- ✅ `self_consistency` - Multiple reasoning paths
- ✅ `moa` - Mixture of Agents

**Incompatible Approaches (DO NOT USE)**:
- ❌ `cepo` - Uses `reasoning_effort`
- ❌ `bon` - Uses `n > 1`
- ❌ `thinkdeeper` - Uses OpenAI-specific features

### Current Active Pipeline: `re2&cot_reflection`
1. **ReRead (re2)** - Processes the query twice to ensure full comprehension
2. **CoT Reflection** - Generates `<thinking>`, `<reflection>`, `<output>` blocks

### Configuration (docker-compose.yml)
```yaml
cepo:
  image: ghcr.io/algorithmicsuperintelligence/optillm:latest-proxy
  ports: ["8080:8000"]
  environment:
    OPTILLM_APPROACH: "re2&cot_reflection"  # Cerebras-compatible!
    OPTILLM_PORT: "8000"
    OPTILLM_MODEL: "qwen-3-32b"  # Default model (tier router may override)
```

### Backend Integration (app/config.py)
```python
CEPO_ENABLED: bool = True
CEPO_BASE_URL: str = "http://cepo:8080"
CEPO_TIMEOUT: float = 120.0
```

### Routing Logic (ai_service.py)
- CePO enabled for JIVE/JIGGA tiers when `settings.CEPO_ENABLED=True`
- CePO disabled when tool calling is needed (not supported)
- On CePO failure → Falls back to direct Cerebras + optillm_enhancements

### Token Tracking
CePO usage is tracked via `track_usage()` in `usage_service.py`:
- `prompt_tokens` - Input tokens from CePO response
- `completion_tokens` - Output tokens from CePO response  
- `total_tokens` - Sum of prompt + completion
- `cepo_metrics` - CePO-specific metadata (approach, timing)

### Available Techniques (OptiLLM v0.3.11)
| Technique | Slug | Cerebras | Description |
|-----------|------|----------|-------------|
| **ReRead** | `re2` | ✅ | Process query twice for comprehension |
| **CoT Reflection** | `cot_reflection` | ✅ | Chain of Thought with reflection |
| **PlanSearch** | `plansearch` | ✅ | Plan before solving |
| **Self Consistency** | `self_consistency` | ✅ | Multiple reasoning paths |
| **Mixture of Agents** | `moa` | ✅ | Multiple agent perspectives |
| **CePO** | `cepo` | ❌ | Uses reasoning_effort (422 error) |
| **Best of N** | `bon` | ❌ | Uses n>1 (422 error) |
| **DeepThink** | `deepthink` | ❌ | OpenAI-specific |

### Start/Stop Commands
```bash
# Start CePO
docker compose up -d cepo

# Stop CePO
docker compose stop cepo

# Rebuild after config change
docker compose up -d --force-recreate cepo

# View logs
docker compose logs cepo --tail=50

# Health check
curl http://localhost:8080/health
```

### Testing CePO
```bash
# Test via curl
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "re2&cot_reflection-qwen-3-32b",
    "messages": [{"role": "user", "content": "What is 15% of 240?"}],
    "temperature": 0.7
  }'

# Expected: Response with <thinking>, <reflection>, <output> sections
```

## Also: optillm_enhancements.py (Fallback)

When CePO is unavailable or for tool-calling requests, `app/services/optillm_enhancements.py` provides:

| Technique | Description | Tiers |
|-----------|-------------|-------|
| **SPL** | System Prompt Layer | ALL |
| **Re-Read (re2)** | Process queries twice | ALL |
| **CoT Reflection** | Chain of thought with self-reflection | JIVE, JIGGA |
| **Planning Mode** | Multi-step planning | JIGGA |
| **Empathy Layer** | SA-context awareness | JIGGA |
