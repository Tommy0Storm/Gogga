# GOGGA Code Style & Conventions

## Python (Backend)

### Naming Conventions
- **Classes**: PascalCase (e.g., `BicameralRouter`, `AIService`)
- **Functions/Methods**: snake_case (e.g., `classify_intent`, `generate_response`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `COMPLEX_KEYWORDS`, `MODEL_SPEED`)
- **Variables**: snake_case (e.g., `input_tokens`, `cost_zar`)
- **Private**: Prefix with underscore (e.g., `_internal_method`)

### Type Hints
- Required for all function signatures
- Use `typing` module: `Optional`, `List`, `Dict`, `Any`, `Literal`
- Pydantic models for data validation

### Docstrings
- Google-style docstrings for all public functions/classes
- Include Args, Returns, Raises sections
- Example:
```python
def classify_intent(message: str) -> Literal["speed", "complex"]:
    """
    Determines whether to route to the Speed Layer or Complex Layer.
    
    Args:
        message: The user's input message
        
    Returns:
        "speed" or "complex" indicating which layer to use
    """
```

### Async Patterns
- Use `async/await` for all I/O operations
- Use `asyncio.to_thread()` for blocking SDK calls
- Never block the FastAPI event loop

### Error Handling
- Custom exception classes in `app/core/exceptions.py`
- Inherit from `GoggaException` base class
- Use specific error types: `InferenceError`, `PaymentError`, `RateLimitError`

## TypeScript (Frontend)

### Naming Conventions
- **Components**: PascalCase (e.g., `AudioRecorder`, `ChatPage`)
- **Functions**: camelCase (e.g., `sendMessage`, `handleAudio`)
- **Interfaces**: PascalCase with descriptive names (e.g., `AudioRecorderProps`)
- **Files**: PascalCase for components, lowercase for utilities

### Component Structure
- Use 'use client' directive for client components
- Props interfaces defined above component
- Hooks at top of component body
- Event handlers before return

### Styling
- Tailwind CSS utility classes
- Monochrome palette: `primary-50` to `primary-950`
- No custom CSS except in globals.css
- Icons: Lucide React only, black color

## General

### Design Theme
- Monochrome with grey gradients
- Font: Quicksand (400 regular, 700 bold)
- Icons: Black Material Icons style (via Lucide)
- Clean, minimal aesthetic

### API Response Format
```json
{
  "response": "...",
  "meta": {
    "model_used": "...",
    "layer": "speed|complex",
    "latency_seconds": 0.0,
    "tokens": {"input": 0, "output": 0},
    "cost_usd": 0.0,
    "cost_zar": 0.0
  }
}
```
