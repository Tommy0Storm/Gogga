# GOGGA Suggested Commands

## Quick Start (Services Already Configured)

### Start Backend
```bash
cd /home/ubuntu/Dev-Projects/Gogga/gogga-backend
source venv314/bin/activate
# Use python3.14t (free-threaded) for 2-3x better concurrency
python3.14t -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Frontend
```bash
cd /home/ubuntu/Dev-Projects/Gogga/gogga-frontend
npm run dev
```

### Test Chat API
```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Howzit!", "user_id": "test123"}'
```

---

## Development Setup

### First-time Setup
```bash
# Navigate to project
cd /home/ubuntu/Dev-Projects/Gogga

# Copy environment template
cp gogga-backend/.env.example gogga-backend/.env

# Edit .env with your credentials
nano gogga-backend/.env
```

### Start All Services (Docker)
```bash
# Start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all containers
docker-compose down
```

### Backend Development
```bash
cd gogga-backend

# Create virtual environment (Python 3.14)
python3.14 -m venv venv314
source venv314/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest tests/ -v

# Run specific test file
pytest tests/test_routing.py -v
```

### Frontend Development
```bash
cd gogga-frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## Utility Commands

### Git
```bash
git status
git add .
git commit -m "message"
git push origin main
```

### File Operations
```bash
# Find Python files
find . -name "*.py" -type f

# Search in files
grep -r "pattern" gogga-backend/

# List directory structure
ls -la
tree -L 2
```

### Docker
```bash
# Rebuild specific service
docker-compose build backend
docker-compose up -d backend

# View running containers
docker ps

# Execute command in container
docker exec -it gogga_api bash

# Prune unused resources
docker system prune -a
```

## Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API Docs | http://localhost:8000/docs |
| API ReDoc | http://localhost:8000/redoc |
| Health Check | http://localhost:8000/health |
| Database | localhost:5432 |
