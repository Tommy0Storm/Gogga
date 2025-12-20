# Document Generation Tool

## Overview

The document generation tool enables Gogga to create professional, publication-ready documents in all 11 SA official languages. The AI invokes this tool when it determines a structured document output is more appropriate than a conversational response.

## Architecture

```
User Request → DocumentClassifier → DocumentProfile
                                         ↓
DocumentService.generate() ← DocumentTemplateEngine.build_prompt()
        ↓
   Model Router (32B/235B)
        ↓
   AI Generation
        ↓
   DocumentToolOutput
```

## Files

| File | Purpose |
|------|---------|
| `app/tools/document_definitions.py` | Core types, enums, Pydantic models, tool definition |
| `app/tools/document_classifier.py` | Multi-dimensional document classification |
| `app/tools/document_templates.py` | Dynamic prompt builder with composable blocks |
| `app/services/document_service.py` | Main service, model routing, generation |
| `app/tools/document_executor.py` | Tool registration and execution |

## Classification System

### DocumentProfile (Frozen Dataclass)

```python
@dataclass(frozen=True, slots=True)
class DocumentProfile:
    domain: DocumentDomain      # LEGAL, BUSINESS, TECHNICAL, etc.
    intent: DocumentIntent      # CREATE, TRANSFORM, ANALYZE, etc.
    complexity: DocumentComplexity  # TRIVIAL → EXPERT
    document_type: str          # Specific type (contract, proposal, cv)
    confidence: float           # Classification confidence 0-1
    triggers_matched: tuple[str, ...]  # Keywords that matched
    requires_235b: bool         # Must use 235B model
    reasoning_required: bool    # Should use thinking mode
    estimated_tokens: int       # Token budget for output
```

### Domain Detection (Weighted Triggers)

Each domain has weighted triggers (0.0-1.0):

```python
DOMAIN_TRIGGERS = {
    DocumentDomain.LEGAL: {
        "popia": 0.95, "ccma": 0.95, "contract": 0.90,
        "litigation": 0.95, "affidavit": 0.95, ...
    },
    DocumentDomain.BUSINESS: {
        "proposal": 0.85, "tender": 0.90, "quarterly report": 0.85, ...
    },
    # ... all 10 domains
}
```

### 235B Mandatory Triggers

These keywords ALWAYS route to 235B:
- `constitutional`, `litigation`, `supreme court`, `high court`
- `comprehensive analysis`, `detailed report`, `white paper`
- `thesis`, `dissertation`, `compliance audit`, `exhaustive`

### African Languages → 235B

All African languages require 235B for quality:
- zu (isiZulu), xh (isiXhosa), st (Sesotho), tn (Setswana)
- ve (Tshivenḓa), ts (Xitsonga), nr (isiNdebele), ss (siSwati), nso (Sepedi)

English (en) and Afrikaans (af) can use 32B.

## Model Routing

| Condition | Model | Provider | Token Budget |
|-----------|-------|----------|--------------|
| African language | 235B | OpenRouter | Up to 30K |
| Expert complexity | 235B | OpenRouter | 30K |
| Mandatory 235B keywords | 235B | OpenRouter | Varies |
| FREE tier | 235B | OpenRouter | 8K max |
| JIVE/JIGGA + reasoning | 32B | Cerebras | 8K (2K reasoning + 6K output) |
| JIVE/JIGGA simple | 32B | Cerebras | 4K |

### Temperature Settings

- **Cerebras 32B thinking mode**: ALWAYS use temp ≥ 0.6 (temp=0 causes infinite loops)
- **235B non-thinking**: temp 0.7

## Template Engine

The template engine builds prompts using composable blocks:

### Core System Prompt

```
## ABSOLUTE RULES (NEVER VIOLATE)
1. LANGUAGE LOCK: Generate in {language_name} only
2. TOPIC LOCK: Stay on "{topic_summary}"
3. PROFESSIONAL STANDARD: {formality} register
4. COMPLETENESS: Generate ready-to-use document
```

### SA Context Block

Includes SA legal framework:
- POPIA, CPA, LRA, BCEA, NCA, BBBEE
- ZAR currency, VAT 15%, SARS compliance
- CCMA dispute resolution

### Domain Structures

Each domain has specific structure guidance:
- LEGAL: Parties, Recitals, Operative Provisions, Schedules
- BUSINESS: Executive Summary, Objectives, Recommendations
- TECHNICAL: Overview, API/Code Examples, Usage Notes
- ACADEMIC: Abstract, Introduction, Methodology, References

### Language Guidance

All 11 SA languages have specific guidance for formal document style.

## Tool Definition

```python
DOCUMENT_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "generate_document",
        "description": "Generate a professional document...",
        "strict": True,  # Required for Cerebras
        "parameters": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Document request"},
                "document_type": {"type": "string"},
                "language": {"type": "string"},
                "formality": {"type": "string", "enum": ["formal", "semi-formal", "casual"]},
                "include_sa_context": {"type": "boolean"},
                "additional_requirements": {"type": "string"}
            },
            "required": ["content"],
            "additionalProperties": False  # Required for Cerebras
        }
    }
}
```

## Integration Points

### Tool Registration

In `app/tools/definitions.py`:
- Added to `SERVER_SIDE_TOOLS` set
- Added to `DOCUMENT_TOOLS` list
- Included in `get_tools_for_tier()` for JIVE/JIGGA

### Execution

In `app/tools/executor.py`:
```python
elif tool_name == "generate_document":
    from app.tools.document_executor import execute_document_tool
    return await execute_document_tool(
        arguments, 
        tier,
        user_id=arguments.get("user_id", "document_tool"),
    )
```

## Token Tracking & Cost Integration (Jan 2025)

### Accurate Token Counting

The document service now tracks **actual token usage** from API responses instead of estimates:

```python
@dataclass
class GenerationResult:
    """Result from AI generation with token tracking"""
    content: str
    input_tokens: int      # From API response.usage.prompt_tokens
    output_tokens: int     # From API response.usage.completion_tokens
    reasoning_tokens: int  # Estimated from thinking block length
    model: str
    provider: str
```

### Cost Tracking Integration

Integrates with `cost_tracker.track_usage()` for accurate billing:

```python
async def _track_generation_cost(self, user_id, tier, result, thinking_mode):
    from app.services.cost_tracker import track_usage, UsageCost
    
    cost_data = await track_usage(
        user_id=user_id,
        model=result.model,
        layer=layer,  # "jigga_think" or "jive_text" or "free_text"
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        tier=tier,
        reasoning_tokens=result.reasoning_tokens,
    )
    return {"usd": cost_data["usd"], "zar": cost_data["zar"]}
```

### DocumentToolOutput Fields

Output now includes accurate token tracking:

```python
class DocumentToolOutput(BaseModel):
    # ... existing fields ...
    input_tokens: int = Field(0, description="Actual input tokens from API")
    output_tokens: int = Field(0, description="Actual output tokens from API")
    reasoning_tokens: int = Field(0, description="Reasoning tokens (thinking mode)")
    cost_usd: float = Field(0.0, description="Actual cost in USD")
    cost_zar: float = Field(0.0, description="Actual cost in ZAR")
```

### Retry Logic

Both OpenRouter and Cerebras methods use `@with_retry` decorator for robustness:

```python
DOCUMENT_RETRY_CONFIG = RetryConfig(
    initial_delay_ms=500,
    multiplier=2.0,
    max_delay_ms=4000,
    jitter_max_ms=100,
    max_attempts=3,
)

@with_retry(config=DOCUMENT_RETRY_CONFIG, operation_name="cerebras_document")
async def _generate_via_cerebras(self, prompt, config, user_tier):
    # ... implementation
```

## Tests

89 tests in 3 files:
- `tests/test_document_classifier.py` - Classification tests
- `tests/test_document_templates.py` - Prompt building tests
- `tests/test_document_service.py` - Service integration tests

Run: `pytest tests/test_document_*.py -v`

## Usage Examples

### Legal Contract
```python
input_data = DocumentToolInput(
    content="Draft an employment contract for software developer",
    document_type="contract",
    language="en",
    formality="formal",
    include_sa_context=True,
)
result = await service.generate(input_data, "jigga")
# → LEGAL domain, COMPLEX complexity, 235B model
# → result.input_tokens, result.output_tokens, result.cost_zar available
```

### Zulu Letter
```python
input_data = DocumentToolInput(
    content="Bhala incwadi kubaqashi mayelana nokulungiswa kwendlu",
    language="zu",
    formality="formal",
    include_sa_context=True,
)
result = await service.generate(input_data, "jive")
# → Forces 235B for African language quality
# → Token usage and cost tracked automatically
```

## Key Design Decisions

1. **Immutable Profiles**: `DocumentProfile` is frozen for thread safety and hashability
2. **Weighted Triggers**: Domain detection uses weighted keyword matching for nuanced classification
3. **Composable Templates**: Prompts built from independent blocks for flexibility
4. **Lazy Singleton**: Service uses lazy initialization to avoid circular imports
5. **SA-First**: All templates include SA context by default (can be disabled)
6. **Accurate Token Tracking**: Uses API response.usage instead of estimates (Jan 2025)
7. **Cost Integration**: Automatic cost tracking via cost_tracker service (Jan 2025)
8. **Retry Logic**: Exponential backoff with jitter for robustness (Jan 2025)

## Token Budgets

| Complexity | Tokens | Use Case |
|------------|--------|----------|
| TRIVIAL | 1,500 | Short notes, quick messages |
| SIMPLE | 4,000 | Standard letters, basic docs |
| MODERATE | 6,000 | Detailed reports, medium complexity |
| COMPLEX | 15,000 | Comprehensive contracts, proposals |
| EXPERT | 30,000 | Exhaustive analyses, full legal frameworks |
