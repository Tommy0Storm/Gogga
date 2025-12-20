# GOGGA Distributed Infrastructure

## Overview (Dec 2025)

GOGGA runs across **two Ubuntu servers** for optimized resource allocation:

| Server | IP | Role | Hostname |
|--------|-----|------|----------|
| **Primary** | 192.168.0.130 | Frontend, Backend, Admin, VS Code host | ubuntu-MacBookPro12-1 |
| **Worker** | 192.168.0.198 | CePO, cAdvisor, NFS Server | hybridwolvin-MacBookPro11-2 |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Windows Host (10.0.0.1)                              │
│                         VS Code → SSH to Primary only                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SSH
                     ┌──────────────┴──────────────┐
                     ▼                              │
    ┌────────────────────────────────┐             │ Docker Context
    │   PRIMARY (192.168.0.130)       │             │ tcp://192.168.0.198:2376
    │   ubuntu-MacBookPro12-1         │             │
    ├─────────────────────────────────┤             ▼
    │ Docker Containers:              │    ┌─────────────────────────────────┐
    │ • gogga_ui (Frontend :3000)     │    │   WORKER (192.168.0.198)        │
    │   - 3GB limit, 2.5GB Node heap  │    │   hybridwolvin-MacBookPro11-2   │
    │ • gogga_api (Backend :8000)     │    ├─────────────────────────────────┤
    │   - 512MB limit                 │    │ Docker Containers:              │
    │ • gogga_admin (Admin :3100)     │    │ • gogga_cepo_worker (:8080)     │
    │   - 2.5GB limit, 2GB Node heap  │    │   - 4GB limit, OptiLLM          │
    │ • gogga_proxy (Proxy :3001)     │    │ • gogga_cadvisor_worker (:8081) │
    │   - 128MB limit                 │    │   - 256MB limit                 │
    │ • gogga_cepo_stub (placeholder) │◄───│                                 │
    │   - 16MB (just for dependency)  │    │ • NFS Server: DEV-Drive         │
    │                                 │    │ • 8 CPU cores, 7.7GB RAM        │
    │ • NFS Client: /mnt/dev-drive    │    │                                 │
    │ • Docker Context Control        │    │                                 │
    └────────────────────────────────┘    └─────────────────────────────────┘
                     │                     │
                     └────── NFS ──────────┘
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

## Network Configuration

| Service | Server | Port | URL |
|---------|--------|------|-----|
| Frontend | Primary | 3000 | http://192.168.0.130:3000 |
| Backend API | Primary | 8000 | http://192.168.0.130:8000 |
| Admin Panel | Primary | 3100 | http://192.168.0.130:3100 |
| HTTPS Proxy | Primary | 3001 | https://192.168.0.130:3001 |
| CePO | Worker | 8080 | http://192.168.0.198:8080 |
| cAdvisor | Worker | 8081 | http://192.168.0.198:8081 |

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
| `infra/distributed/docker-compose.worker.yml` | Worker containers |
| `infra/distributed/status.sh` | Status check script |
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

## Access URLs (IMPORTANT!)

### From Windows (10.0.0.1 network)
```
Frontend:  http://10.0.0.1:3000   ← HTTPS!
Backend:   http://10.0.0.1:8000
Admin:     http://10.0.0.1:3100
```

### From LAN (WiFi 192.168.0.x)
```
Frontend:  http://192.168.0.130:3000   ← HTTPS!
Backend:   http://192.168.0.130:8000
Admin:     http://192.168.0.130:3100
CePO:      http://192.168.0.198:8080
cAdvisor:  http://192.168.0.198:8081
```

**NOTE**: Frontend uses HTTPS with self-signed cert. Accept browser warning.
