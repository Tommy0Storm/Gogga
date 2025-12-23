# Gogga Service Endpoints

## Distributed Infrastructure Overview

| Service | URL | Protocol | Runs On | Port |
|---------|-----|----------|---------|------|
| **Frontend** | https://192.168.0.130:3002 | HTTPS | MAC-1 Primary | 3002 |
| **Backend** | https://192.168.0.130:8000 | HTTPS | MAC-1 Primary | 8000 |
| **Admin** | http://192.168.0.130:3100 | HTTP | MAC-1 Primary | 3100 |
| **CePO** | http://192.168.0.198:8080 | HTTP | MAC-2 Worker | 8080 |
| **ChromaDB** | http://192.168.0.198:8001 | HTTP | MAC-2 Worker | 8001 |
| **Redis** | redis://192.168.0.198:6379 | TCP | MAC-2 Worker | 6379 |
| **cAdvisor** | http://192.168.0.198:8081 | HTTP | MAC-2 Worker | 8081 |

## Network Topology

```
Dell Latitude 5520 (VS Code, 192.168.0.x)
     │ SSH
     ├──────────────────────────────────┐
     ▼                                  ▼
MAC-1 PRIMARY (192.168.0.130)        MAC-2 WORKER (192.168.0.198)
├─ Frontend (:3002)                  ├─ CePO (:8080)
├─ Backend (:8000)                   ├─ ChromaDB (:8001)
├─ Admin (:3100)                     ├─ Redis (:6379)
└─ Proxy (:3001)                     └─ cAdvisor (:8081)
```

## Health Check Endpoints

| Service | Health Check URL |
|---------|------------------|
| Frontend | `https://192.168.0.130:3002` |
| Backend | `https://192.168.0.130:8000/health` |
| Admin | `http://192.168.0.130:3100` |
| CePO | `http://192.168.0.198:8080/v1/models` |
| ChromaDB | `http://192.168.0.198:8001/api/v2/heartbeat` |
| Redis | TCP connection to port 6379 |
| cAdvisor | `http://192.168.0.198:8081/containers/` |

## Notes

- **Frontend/Backend** use self-signed HTTPS certificates (accept browser warning)
- **Redis** is TCP only, no HTTP interface - use `redis-cli ping`
- **cAdvisor** returns 307 redirect to `/containers/`
- **ChromaDB** may show "unhealthy" in Docker but responds correctly

## Quick Test Script

Run `infra/distributed/health-check.sh` to verify all services.
