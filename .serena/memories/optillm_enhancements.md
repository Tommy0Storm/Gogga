# OptiLLM Enhancements - Test-Time Compute Optimizations

## Overview (Dec 2025)
Implemented OptiLLM inference optimization techniques directly in code,
without requiring the CePO sidecar proxy.

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     ai_service.py                           │
├─────────────────────────────────────────────────────────────┤
│  generate_response()                                        │
│       ↓                                                     │
│  get_enhancement_config(tier, is_complex)                   │
│       ↓                                                     │
│  enhance_system_prompt(prompt, config)  ← SPL + CoT + Plan  │
│       ↓                                                     │
│  enhance_user_message(message, config)  ← Re-Read (re2)     │
│       ↓                                                     │
│  LLM Call (Cerebras/OpenRouter)                             │
│       ↓                                                     │
│  parse_enhanced_response(content)       ← Extract sections  │
└─────────────────────────────────────────────────────────────┘
```

## Implemented Techniques

| Technique | Slug | Tier | Accuracy Gain | Token Cost |
|-----------|------|------|---------------|------------|
| **System Prompt Learning** | spl | ALL | +5-10% | 1.1x |
| **Re-Read (Re2)** | re2 | ALL | +10-15% | 1.5x |
| **CoT Reflection** | cot_reflection | JIVE+ | +15-25% | 2-3x |
| **Planning Mode** | planning | JIGGA | +18-30% | 2-4x |
| **Empathetic Reasoning** | empathy | ALL | +human-centric | 1.2x |

## Tier-Based Enhancement Levels

| Tier | Level | Techniques |
|------|-------|------------|
| FREE | LIGHT | SPL, Re-Read |
| JIVE | MODERATE | SPL, Re-Read, CoT Reflection |
| JIGGA | FULL | SPL, Re-Read, CoT Reflection, Planning, Empathy |

## Empathetic Reasoning (NEW)

Instructs LLM to think about:
1. **WHY is the user asking?** - Underlying situation/need
2. **What emotion are they feeling?** - Stressed, curious, frustrated
3. **What to offer beyond literal answer?** - Proactive tips, next steps
4. **How to tailor the response?** - Match emotional state, complexity

```python
enhance_system_prompt(prompt, config, include_empathy=True)  # Default
enhance_system_prompt(prompt, config, include_empathy=False) # Opt-out
```

## Key Files

- `app/services/optillm_enhancements.py` - Core enhancement module
- `tests/test_optillm_enhancements.py` - 37 tests
- `tests/test_personality_modes.py` - 33 tests (personality + empathy)
- `app/services/ai_service.py` - Integration with AI service

## Enhancement Config

```python
@dataclass(frozen=True)
class EnhancementConfig:
    level: EnhancementLevel = EnhancementLevel.NONE
    use_cot_reflection: bool = False
    use_reread: bool = False
    use_planning: bool = False
    use_self_consistency: bool = False
    consistency_samples: int = 3
```

## Usage Example

```python
from app.services.optillm_enhancements import (
    get_enhancement_config,
    enhance_system_prompt,
    enhance_user_message,
)

# Get tier-appropriate config
config = get_enhancement_config(tier="jigga", is_complex=True)

# Apply enhancements
enhanced_prompt = enhance_system_prompt(base_prompt, config)
enhanced_message = enhance_user_message(user_message, config)
```

## Structured Response Format

When CoT Reflection is enabled, responses may include:
```xml
<thinking>Step-by-step analysis...</thinking>
<reflection>Reviewing the analysis...</reflection>
<plan>1. Step one\n2. Step two</plan>
<output>Final answer here</output>
```

Use `parse_enhanced_response(content)` to extract sections.

## Model Configuration

### Qwen 32B (JIVE/JIGGA General)
- Temperature: 0.6 (CRITICAL: never use 0)
- Top-P: 0.95
- Top-K: 20
- Max Tokens: 4096 (casual), 8000 (extended)

### Qwen 235B (JIGGA Complex/Legal)
- Same temperature/top_p settings
- Max Tokens: 8000 (normal), 32000 (extended)
- Triggers: legal keywords, complex analysis

## Benefits Summary

1. **SPL (System Prompt Learning)**: Consistent reasoning patterns
2. **Re-Read (Re2)**: Better comprehension of complex queries
3. **CoT Reflection**: Structured thinking with self-correction
4. **Planning Mode**: Break down multi-step problems

## NOT Implemented (Too Expensive)

- Self-Consistency (3-5x token cost)
- Best-of-N Sampling (Nx token cost)
- Mixture of Agents (4-6x, needs multiple models)
- MCTS (5-10x, computationally intensive)

These would require significant token budget and are better suited
for batch processing or critical decisions, not real-time chat.
