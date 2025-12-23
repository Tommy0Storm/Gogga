# GOGGA Distributed Infrastructure

## Overview (Dec 2025)

GOGGA runs across **two Mac Minis (8GB RAM each)** running Ubuntu with fast NVMe storage:

| Server | IP | Hardware | Disk Performance | RAM |
|--------|-----|----------|------------------|-----|
| **Primary** | 192.168.0.130 | Mac (Ubuntu) | NVMe 430MB/s read, 200+MB/s write | 8GB |
| **Worker** | 192.168.0.198 | Mac (Ubuntu) | NVMe 430MB/s read, 200+MB/s write | 8GB |

**Development Machine**: Dell Latitude 5520 on 192.168.0.x network with VS Code (SSH to both servers)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Dell Latitude 5520 (VS Code, 192.168.0.x)                       │
│                    SSH to both Primary & Worker                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SSH
                     ┌──────────────┴──────────────┐
                     ▼                              ▼
    ┌────────────────────────────────┐    ┌─────────────────────────────────┐
    │   MAC-1 PRIMARY (192.168.0.130) │    │   MAC-2 WORKER (192.168.0.198)  │
    │   ubuntu-MacBookPro12-1         │    │   hybridwolvin-MacBookPro11-2   │
    │   NVMe: 430/200+ MB/s           │    │   NVMe: 430/200+ MB/s           │
    ├─────────────────────────────────┤    ├─────────────────────────────────┤
    │ Docker Containers:              │    │ Docker Containers:              │
    │ • gogga_ui (Frontend :3000)     │    │ • gogga_cepo_worker (:8080)     │
    │   - 3GB limit, 2.5GB Node heap  │    │   - 4GB limit, OptiLLM          │
    │ • gogga_api (Backend :8000)     │    │ • gogga_cadvisor_worker (:8081) │
    │   - 512MB limit                 │    │   - 256MB limit                 │
    │ • gogga_admin (Admin :3100)     │    │                                 │
    │   - 2.5GB limit, 2GB Node heap  │◄───│ • NFS Server: DEV-Drive         │
    │ • gogga_proxy (Proxy :3001)     │    │ • 8 CPU cores, 7.7GB RAM        │
    │   - 128MB limit                 │    │                                 │
    │ • gogga_cepo_stub (placeholder) │    │                                 │
    │   - 16MB (just for dependency)  │    │                                 │
    │                                 │    │                                 │
    │ • NFS Client: /mnt/dev-drive    │    │                                 │
    │ • Docker Context Control        │ ──►│ Docker Remote (tcp://...:2376)  │
    └────────────────────────────────┘    └─────────────────────────────────┘
                     │                     │
                     └────── NFS ──────────┘
```

## NVMe Optimization

Both Macs have fast PCIe NVMe storage. Run `infra/distributed/optimize-nvme.sh` on both nodes:

```bash
# Optimizations applied:
# - noop/none scheduler for lowest latency
# - Increased readahead for sequential workloads
# - I/O affinity optimization
# - noatime mount options
```

## Memory Allocation

### Primary Server (7.7GB total)
| Container | Limit | Reserved | Purpose |
|-----------|-------|----------|---------|
| gogga_ui (Frontend) | 3.0GB | 1.0GB | Next.js 16 + RxDB + React 19 |
| gogga_admin | 2.5GB | 768MB | Dashboard + Docker management |
| gogga_api (Backend) | 512MB | 256MB | FastAPI (lightweight) |
| gogga_proxy | 128MB | 32MB | SSL termination only |
| gogga_cepo_stub | 16MB | 8MB | Placeholder for dependencies |
| **TOTAL** | 6.1GB | 2.0GB | Leaves ~1.5GB for system |

### Worker Server (7.7GB total)
| Container | Limit | Reserved | Purpose |
|-----------|-------|----------|---------|
| gogga_cepo_worker | 4.0GB | 2.0GB | OptiLLM AI processing |
| gogga_cadvisor_worker | 256MB | 64MB | Container monitoring |
| **TOTAL** | 4.3GB | 2.1GB | Leaves ~3.4GB for system |

## CePO Configuration

**Worker CePO** (http://192.168.0.198:8080):
- Approach: `re2&cot_reflection` (Cerebras-compatible)
- Model: qwen-3-32b
- Features: ReRead + CoT with structured thinking

**Primary services point to Worker CePO**:
- `CEPO_URL=http://192.168.0.198:8080` in `.env`
- Frontend/Backend/Admin all route AI through worker

## Network Configuration (Dec 2025 - CURRENT)

| Service | Server | Port | Protocol | URL |
|---------|--------|------|----------|-----|
| Frontend | Primary | 3002 | HTTPS | https://192.168.0.130:3002 |
| Backend API | Primary | 8000 | HTTPS | https://192.168.0.130:8000 |
| Admin Panel | Primary | 3100 | HTTP | http://192.168.0.130:3100 |
| CePO | Worker | 8080 | HTTP | http://192.168.0.198:8080 |
| ChromaDB | Worker | 8001 | HTTP | http://192.168.0.198:8001 |
| Redis | Worker | 6379 | TCP | redis://192.168.0.198:6379 |
| cAdvisor | Worker | 8081 | HTTP | http://192.168.0.198:8081 |

**Health Check Script**: `./infra/distributed/health-check.sh`
**Detailed Endpoints**: `.serena/memories/service_endpoints.md`

## SSH Configuration

Passwordless SSH from primary to worker:

```bash
# Quick connect
ssh gogga-worker

# ~/.ssh/config entry
Host gogga-worker
    HostName 192.168.0.198
    User hybridwolvin
    IdentityFile ~/.ssh/id_ed25519
```

## Docker Contexts

```bash
# List contexts
docker context ls

# Use primary (default)
docker --context gogga-primary ps

# Use worker
docker --context gogga-worker ps

# Aliases
alias dp='docker --context gogga-primary'
alias dw='docker --context gogga-worker'
```

## NFS Mount

| Location | Path |
|----------|------|
| Primary mount | `/mnt/dev-drive` |
| Worker export | `/home/hybridwolvin/DEV-Drive` |

```
DEV-Drive/
├── docker/
│   ├── compose/      # Worker compose files
│   ├── volumes/      # Persistent data
│   └── logs/         # Container logs
├── gogga-config/     # Shared .env files
└── projects/         # Shared project files
```

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.override.yml` | Memory optimization, CePO stub |
| `infra/distributed/docker-compose.worker.yml` | Worker containers (CePO, ChromaDB, Redis, cAdvisor) |
| `infra/distributed/docker-compose.primary.yml` | Primary containers |
| `infra/distributed/health-check.sh` | Verify all 7 services are running |
| `infra/distributed/deploy.sh` | Deploy to primary/worker/both |
| `infra/distributed/optimize-nvme.sh` | NVMe tuning script |
| `.serena/memories/service_endpoints.md` | Complete service URL reference |
| `gogga-backend/.env` | CEPO_URL pointing to worker |

## Management Commands

```bash
# Check all services
gogga-status

# Restart worker containers
dw compose -f /mnt/dev-drive/docker/compose/docker-compose.worker.yml restart

# View worker CePO logs
dw logs gogga_cepo_worker -f

# Restart primary stack
cd /home/ubuntu/Dev-Projects/Gogga && docker compose up -d
```

## Auto-Start Configuration

Both servers configured for automatic startup:
- Docker: `systemctl enable docker`
- Containers: `restart: unless-stopped`
- NFS: systemd automount on primary, nfs-kernel-server on worker

## Access URLs (Dec 2025 - VERIFIED WORKING)

### From Dell Latitude (192.168.0.x network)
```
Frontend:  https://192.168.0.130:3002   ← HTTPS with self-signed cert
Backend:   https://192.168.0.130:8000   ← HTTPS with self-signed cert
Admin:     http://192.168.0.130:3100
CePO:      http://192.168.0.198:8080
ChromaDB:  http://192.168.0.198:8001
Redis:     redis://192.168.0.198:6379
cAdvisor:  http://192.168.0.198:8081
```

### Quick Health Check
```bash
./infra/distributed/health-check.sh
```

### SSH from Dell
```bash
# Primary (Mac 1)
ssh ubuntu@192.168.0.130

# Worker (Mac 2)
ssh hybridwolvin@192.168.0.198
# OR with config alias
ssh gogga-worker
```

**NOTE**: Frontend uses HTTPS with self-signed cert. Accept browser warning.

## Development Workflow

```bash
# From Dell VS Code:
# 1. SSH to primary
ssh ubuntu@192.168.0.130

# 2. Start services
cd /home/ubuntu/Dev-Projects/Gogga
docker compose up -d

# 3. Check worker (from primary)
docker --context gogga-worker ps

# 4. Run NVMe optimization (on both servers)
./infra/distributed/optimize-nvme.sh
```

## Document Pollination Architecture (Dec 2025)

### Overview

Document processing uses a dual-path architecture:
- **Simple Path**: Fast, direct processing for basic documents
- **Complex Path**: OptiLLM-enhanced processing via CePO for legal/medical/large docs

### Worker Services for Document Processing

| Service | Port | Purpose | RAM |
|---------|------|---------|-----|
| CePO | 8080 | OptiLLM enhanced reasoning | 2.5GB |
| ChromaDB | 8001 | Vector database for embeddings | 1.5GB |
| Redis | 6379 | Job queue and caching | 512MB |
| Document Processor | 8004 | Routes and processes documents | 1GB |

### Document Classification

Documents are classified as SIMPLE or COMPLEX based on:
- **Size**: > 2MB → COMPLEX
- **Filename**: Contains "contract", "legal", "medical", "compliance" → COMPLEX
- **Content**: Constitutional, litigation keywords → COMPLEX
- **Explicit flag**: `explicit_complex: true` → COMPLEX

### Processing Flow

```
                          ┌─────────────────────┐
                          │   User uploads doc  │
                          └──────────┬──────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Backend (130:8000) │
                          │  Classify document  │
                          └──────────┬──────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     │                               │
              SIMPLE │                       COMPLEX │
                     ▼                               ▼
         ┌───────────────────┐           ┌───────────────────────┐
         │  Direct LLM call  │           │  Worker (198:8004)    │
         │  + embeddings     │           │  Document Processor   │
         └─────────┬─────────┘           └───────────┬───────────┘
                   │                                 │
                   │                     ┌───────────▼───────────┐
                   │                     │  CePO (198:8080)      │
                   │                     │  OptiLLM re2&cot      │
                   │                     └───────────┬───────────┘
                   │                                 │
                   └──────────────┬──────────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │  ChromaDB (198:8001)    │
                     │  Store embeddings       │
                     └────────────┬────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │  Return to user         │
                     └─────────────────────────┘
```

### Environment Variables

```bash
# Primary Backend (.env)
CEPO_URL=http://192.168.0.198:8080
CHROMA_URL=http://192.168.0.198:8001
REDIS_URL=redis://192.168.0.198:6379
DOC_PROCESSOR_URL=http://192.168.0.198:8004
OPTILLM_APPROACH=re2&cot_reflection
COMPLEX_DOC_SIZE_BYTES=2000000
```

### Deployment Commands

```bash
# From Dell VS Code terminal
cd infra/distributed

# Deploy all nodes
./deploy.sh all

# Deploy worker only (has new services)
./deploy.sh worker

# Check status
./deploy.sh status

# Run benchmark
./deploy.sh benchmark
# or: python bench_doc.py --backend http://192.168.0.130:8000 -n 20 -v
```

### Benchmark Results (Expected)

| Path | Avg Latency | Throughput |
|------|-------------|------------|
| Simple | ~200-500ms | 2-5 req/s |
| Complex (OptiLLM) | ~2-10s | 0.1-0.5 req/s |

OptiLLM adds significant latency but improves quality for complex documents.

### Cache Directories (NVMe-backed)

```
/opt/gogga-cache/
├── PRIMARY (130)
│   ├── frontend-data/
│   ├── backend-logs/
│   └── nginx/
│
└── WORKER (198)
    ├── cepo/           # OptiLLM state
    ├── chroma/         # Vector DB (fast NVMe important!)
    ├── redis/          # Persistence
    └── processed/      # Processed doc cache
```

### Monitoring

- **cAdvisor**: http://192.168.0.198:8081 - Container resource usage
- **Redis CLI**: `redis-cli -h 192.168.0.198 INFO` - Queue stats
- **ChromaDB**: http://192.168.0.198:8001/api/v1/heartbeat - Health check

### Fallback Behavior

If CePO is overloaded (queue > 10) or timeout (> 120s):
1. Return job ID with ETA
2. Fallback to simple path with best-effort summary
3. Circuit breaker: 5 consecutive failures → disable OptiLLM for 60s
