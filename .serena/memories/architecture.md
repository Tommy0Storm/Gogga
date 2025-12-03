# GOGGA Architecture Details

## Quadricameral Routing Engine

The core innovation of GOGGA is the 4-layer Quadricameral Router located in `gogga-backend/app/core/router.py`.

### Model Architecture

| Layer | Model ID | CePO | Speed | Use Case |
|-------|----------|------|-------|----------|
| SPEED | `llama3.1-8b` | ❌ | ~2,200 t/s | Fast factual responses |
| COMPLEX | `qwen-3-235b-a22b-instruct-2507` | ❌ | ~1,400 t/s | Nuanced conversations |
| REASONING | `llama3.1-8b` | ✅ | ~2,200 t/s | Fast multi-step reasoning |
| DEEP_REASONING | `qwen-3-235b-a22b-instruct-2507` | ✅ | ~1,400 t/s | Complex analysis |

### CePO (Cerebras Planning Optimization)
- Runs as Docker sidecar container (OptiLLM with `--approach cepo`)
- Provides iterative chain-of-thought planning
- Automatic fallback to non-CePO layer if unavailable
- Configuration: `CEPO_URL=http://localhost:8080`, `CEPO_ENABLED=true`

### Classification Logic
1. **Deep Reasoning Detection**: "deep analysis", "comprehensive review", "thoroughly examine"
2. **Fast Reasoning Detection**: "explain", "analyze", "how does", "solve step by step"
3. **Complex Keywords**: Legal, coding, translation context
4. **Length Analysis**: Messages > 50 words route to Complex Layer
5. **Default Fallback**: Simple queries use Speed Layer

### Complex Keywords Trigger
- Legal: `popia`, `constitution`, `act`, `contract`, `rights`, `bbbee`, `fica`
- Coding: `code`, `function`, `python`, `api`, `database`, `docker`
- Translation: `translate`, `isizulu`, `isixhosa`, `afrikaans`

## System Prompts

Each layer has a tailored system prompt in the router.

## PayFast Integration

### Signature Generation
1. Sort parameters alphabetically
2. Filter empty values
3. URL encode with `quote_plus` (spaces → +)
4. Append passphrase
5. MD5 hash

### Key Requirements
- Subscription frequency `3` = Monthly
- Cancellation uses `PUT` request (not DELETE)
- Sandbox mode with `testing=true` query param

## Data Flow

```
User Message
     ↓
QuadricameralRouter.classify_intent()
     ↓
SPEED / COMPLEX / REASONING / DEEP_REASONING
     ↓
CePO Sidecar (if reasoning) OR Cerebras SDK
     ↓
Cost Tracker → Token Ledger
     ↓
Response with Metadata
```
