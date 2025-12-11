# GOGGA Plugin System

## Overview

The GOGGA plugin system provides a framework for enriching chat requests with passive analysis and intelligence **before** they reach the LLM. Plugins run on **EVERY request** and **CANNOT be disabled**.

## Architecture

```
User Input → Plugins (before_request) → LLM → Plugins (after_response) → User Output
               ↓
         Language Detection
         Context Enrichment
         Metadata Addition
```

### Plugin Lifecycle

1. **before_request**: Analyze input, enrich context, modify messages
2. **LLM Processing**: Request sent to appropriate tier model
3. **after_response**: Transform output, add metadata (optional)

## Current Plugins

### Language Detector v3.0 (Dark Matter Edition)

**Purpose**: Detects South African languages and enriches context with cultural intelligence.

**Features**:
- ✅ All 11 SA official languages supported
- ✅ Multi-stage detection (vocabulary → morphology → n-grams → cultural markers)
- ✅ Code-switching detection
- ✅ Confidence scoring (0.0-1.0)
- ✅ Automatic system prompt injection for vernacular
- ✅ Language family classification

**Supported Languages**:
| Code | Language | Family | Greeting |
|------|----------|--------|----------|
| en | English | Germanic | Hello |
| af | Afrikaans | Germanic | Hallo |
| zu | isiZulu | Nguni | Sawubona |
| xh | isiXhosa | Nguni | Molo |
| nso | Sepedi | Sotho-Tswana | Thobela |
| tn | Setswana | Sotho-Tswana | Dumela |
| st | Sesotho | Sotho-Tswana | Lumela |
| ts | Xitsonga | Tswa-Ronga | Avuxeni |
| ss | siSwati | Nguni | Sawubona |
| ve | Tshivenda | Venda | Ndaa |
| nr | isiNdebele | Nguni | Lotjhani |

## Detection Algorithm

### Multi-Stage Scoring

```python
S_final = (W_vocab × 0.5) + (W_morph × 0.3) + (W_ngram × 0.15) + (W_cultural × 0.05)
```

**Stage 1: Vocabulary (50% weight)**
- Direct word matches from core vocabulary
- Most reliable indicator

**Stage 2: Morphology (30% weight)**
- Root/prefix pattern matching
- Language family detection
- Handles misspellings and informal text

**Stage 3: N-Grams (15% weight)**
- Character sequence frequency (3-grams)
- Fine-grained disambiguation
- Useful for SMS/informal text

**Stage 4: Cultural Markers (5% weight)**
- Greetings, honorifics, common phrases
- High-confidence bonus

### Confidence Interpretation

| Confidence | Interpretation | Action |
|------------|----------------|--------|
| 0.8 - 1.0 | High confidence, single language | Strong system prompt injection |
| 0.35 - 0.79 | Moderate, likely code-switching | Bilingual guidance |
| 0.0 - 0.34 | Low confidence or fallback | Minimal intervention |

## Metadata Structure

Plugins add metadata to requests:

```json
{
  "metadata": {
    "language_intelligence": {
      "code": "zu",
      "name": "isiZulu",
      "confidence": 0.87,
      "is_hybrid": false,
      "family": "Nguni",
      "method": "vocab",
      "text_sample": "Sawubona, unjani namhlanje?"
    }
  }
}
```

## System Prompt Injection

For non-English with confidence > 0.35, the plugin automatically injects cultural context:

### High Confidence (Single Language)
```
🌍 Cultural Context: User is communicating in isiZulu (confidence: 87%).
Response Strategy: Respond primarily in isiZulu.
Use appropriate honorifics and cultural markers from Nguni tradition.
Greeting: 'Sawubona'
Note: English technical terms are acceptable when no isiZulu equivalent exists.
```

### Code-Switching (Hybrid)
```
🌍 Cultural Context: User is code-switching between isiZulu and English.
Response Strategy: Mirror the user's bilingual style.
Use isiZulu for greetings, cultural expressions, and emphasis.
Use English for technical terms and complex concepts.
Natural code-switching is encouraged.
Greeting: Start with 'Sawubona' if appropriate.
```

## Creating a New Plugin

### 1. Implement the Protocol

```python
from app.plugins.base import Plugin
from typing import Dict, Any

class MyPlugin:
    name = "my_plugin"
    
    async def before_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        # Analyze input, enrich metadata
        messages = request.get("messages", [])
        
        # Add your analysis
        if "metadata" not in request:
            request["metadata"] = {}
        request["metadata"]["my_analysis"] = {"score": 0.95}
        
        return request
    
    async def after_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        # Transform output (if needed)
        return response
```

### 2. Register the Plugin

In `app/services/ai_service.py`:

```python
def get_plugins() -> list[Plugin]:
    global _plugins
    if _plugins is None:
        _plugins = [
            LanguageDetectorPlugin(),
            MyPlugin(),  # Add here
        ]
    return _plugins
```

### 3. Test Thoroughly

Create tests in `tests/test_my_plugin.py`:

```python
import pytest
from app.plugins.my_plugin import MyPlugin

@pytest.fixture
def plugin():
    return MyPlugin()

@pytest.mark.asyncio
async def test_before_request(plugin):
    request = {"messages": [{"role": "user", "content": "test"}]}
    enriched = await plugin.before_request(request)
    assert "my_analysis" in enriched["metadata"]
```

## Plugin Guidelines

### DO:
✅ Run fast (< 100ms for detection)
✅ Handle errors gracefully (pipeline continues even if plugin fails)
✅ Add metadata under `request["metadata"]` or `response["metadata"]`
✅ Use logging for debugging
✅ Test edge cases thoroughly

### DON'T:
❌ Make external API calls (latency risk)
❌ Modify user input content directly (add system prompts instead)
❌ Throw exceptions (use try/except)
❌ Store state between requests (stateless design)
❌ Assume message structure (defensive coding)

## Performance

Language Detector v3.0 benchmarks:

| Operation | Time | Notes |
|-----------|------|-------|
| Simple greeting | ~1-2ms | Vocabulary match |
| Long paragraph | ~5-10ms | Full multi-stage analysis |
| Code-switching text | ~8-12ms | Hybrid detection |

**Total overhead**: < 15ms per request (negligible compared to LLM latency)

## Testing

Run all plugin tests:

```bash
cd gogga-backend
pytest tests/test_language_detector.py -v
```

Run specific test class:

```bash
pytest tests/test_language_detector.py::TestZuluDetection -v
```

Test with coverage:

```bash
pytest tests/test_language_detector.py --cov=app.plugins --cov-report=html
```

## Future Plugins

Potential additions:

1. **Profanity Filter**: Sanitize inappropriate content
2. **Sentiment Analyzer**: Detect user mood/emotion
3. **Context RAG Enricher**: Automatic document retrieval
4. **Safety Monitor**: Detect harmful requests
5. **Translation Cache**: Remember language preferences per user
6. **Cultural Calendar**: Inject context for SA holidays/events

## FAQ

**Q: Can users disable language detection?**  
A: No. Plugins are mandatory for maintaining GOGGA's SA-centric cultural intelligence.

**Q: Does language detection affect all tiers?**  
A: Yes. FREE, JIVE, and JIGGA all benefit from language intelligence.

**Q: What if detection is wrong?**  
A: Low-confidence detections have minimal impact. Users can always respond in English to reset context.

**Q: How does this affect token usage?**  
A: System prompt injection adds ~50-100 tokens for non-English detections. Negligible cost vs benefit.

**Q: Can plugins access user data?**  
A: Only data in the current request. No persistent storage or cross-request access.

## Technical Details

### Plugin Initialization

Plugins are lazily initialized on first request:

```python
_plugins: list[Plugin] | None = None

def get_plugins() -> list[Plugin]:
    global _plugins
    if _plugins is None:
        _plugins = [LanguageDetectorPlugin()]
        logger.info(f"Initialized {len(_plugins)} plugins")
    return _plugins
```

### Error Handling

Plugins are wrapped in try/except to prevent pipeline disruption:

```python
async def run_plugins_before_request(request: dict) -> dict:
    plugins = get_plugins()
    for plugin in plugins:
        try:
            request = await plugin.before_request(request)
        except Exception as e:
            logger.error(f"Plugin {plugin.name} error: {e}")
            # Pipeline continues
    return request
```

### Memory Efficiency

Using `__slots__` and `frozen=True` dataclasses:

```python
@dataclass(frozen=True, slots=True)
class LanguageProfile:
    code: str
    name: str
    # ... reduces memory by ~40%
```

## Contributing

To contribute a new plugin:

1. Fork the repo
2. Create plugin in `app/plugins/your_plugin.py`
3. Implement `Plugin` protocol
4. Add tests in `tests/test_your_plugin.py`
5. Update this README
6. Submit PR with performance benchmarks

## License

GOGGA Plugin System - Proprietary
© 2025 GOGGA Chat - All Rights Reserved
