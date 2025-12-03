# GOGGA Task Completion Checklist

## Before Submitting Code

### 1. Backend (Python)
```bash
cd gogga-backend

# Run tests
pytest tests/ -v

# Check for syntax errors (if available)
python -m py_compile app/**/*.py

# Optional: Format with black
black app/

# Optional: Sort imports
isort app/
```

### 2. Frontend (TypeScript)
```bash
cd gogga-frontend

# Lint code
npm run lint

# Type check
npx tsc --noEmit

# Build to verify
npm run build
```

### 3. Docker Verification
```bash
# Rebuild and test containers
docker-compose build
docker-compose up -d

# Check health endpoints
curl http://localhost:8000/health
curl http://localhost:3000
```

## Code Review Checklist

- [ ] Type hints on all function signatures (Python)
- [ ] Docstrings on public functions/classes
- [ ] Error handling with custom exceptions
- [ ] Async patterns for I/O operations
- [ ] No hardcoded secrets or credentials
- [ ] Cost tracking for AI calls
- [ ] Monochrome theme compliance (Frontend)
- [ ] Black icons only (Lucide)
- [ ] Quicksand font usage

## Testing Guidelines

### Unit Tests Required For:
- Bicameral routing logic changes
- PayFast signature generation
- Cost calculation modifications
- New API endpoints

### Test Naming Convention
```python
def test_<feature>_<scenario>():
    """Test description."""
```

## Documentation Updates

When modifying:
- API endpoints → Update `/docs` endpoint descriptions
- Models → Update Pydantic model docstrings
- Services → Update service class docstrings
- Config → Update `.env.example`

## Deployment Notes

For Azure deployment:
1. Update container images in ACR
2. Verify secrets in Azure Container Apps
3. Test South Africa North region latency
4. Verify PayFast production credentials
