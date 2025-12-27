# Podman Migration Guide

> **Created:** December 2025  
> **Status:** Active  
> **Purpose:** Replace Docker with Podman for rootless container development

## Why Podman?

### The Problem with Docker
Docker runs containers as **root**, causing:
1. `.next/` directory created with root ownership
2. `prisma/generated/` created with root ownership
3. Turbopack cache corruption when switching between Docker and local dev
4. "Permission denied" errors on SST file writes
5. Continuous fighting with `sudo chown` commands

### Podman Solution
Podman runs containers **rootless by default**:
- Files created as current user (ubuntu:ubuntu)
- No permission conflicts between Docker and local dev
- Drop-in replacement for Docker CLI
- OCI-compliant, same images work

## Installation (Ubuntu)

Already installed on GOGGA system:
```bash
podman version  # 4.9.3
which podman    # /usr/bin/podman
```

To install on fresh system:
```bash
sudo apt-get update
sudo apt-get install -y podman podman-compose
```

## Key Differences from Docker

### Rootless Operation
```bash
# Docker (runs as root inside container)
docker run -v ./app:/app alpine touch /app/file.txt
# Result: file.txt owned by root:root

# Podman (runs as current user)
podman run -v ./app:/app alpine touch /app/file.txt
# Result: file.txt owned by ubuntu:ubuntu
```

### Port Binding
Rootless containers cannot bind to privileged ports (< 1024) by default.

**Option 1: Use high ports (recommended)**
```yaml
ports:
  - "3000:3000"  # OK - both unprivileged
  - "8000:8000"  # OK
```

**Option 2: Allow unprivileged port binding**
```bash
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
# Add to /etc/sysctl.conf for persistence
```

### Volume Mounts
Add `:Z` suffix for SELinux labeling (if SELinux enabled):
```yaml
volumes:
  - ./app:/app:Z  # SELinux relabel for container access
```

GOGGA uses Ubuntu without SELinux, so `:Z` is optional.

## podman-compose vs docker-compose

### Compatibility Extensions
Add to compose file for Docker compatibility:
```yaml
x-podman:
  default_net_behavior_compat: true  # Docker-style networking
  default_net_name_compat: true      # Use network names as-is
```

### Running Services
```bash
# Same commands work!
podman-compose up -d
podman-compose down
podman-compose logs -f frontend

# Or use podman directly
podman compose up -d  # Built-in compose support
```

### Pod Mode
podman-compose creates a pod for each project by default:
```yaml
x-podman:
  in_pod: false  # Disable pod mode if needed (e.g., for userns_mode)
```

## Migration Steps for GOGGA

### 1. Stop Docker Services
```bash
cd /home/ubuntu/Dev-Projects/Gogga
docker compose down
```

### 2. Clean Root-Owned Files
```bash
sudo rm -rf gogga-frontend/.next
sudo rm -rf gogga-frontend/prisma/generated
sudo rm -rf gogga-frontend/node_modules/.cache
```

### 3. Start with Podman
```bash
podman-compose up -d backend cepo
# Frontend recommended local for now:
cd gogga-frontend && pnpm dev:http
```

### 4. Verify Permissions
```bash
ls -la gogga-frontend/.next/
# Should show ubuntu:ubuntu ownership
```

## GOGGA-Specific Configuration

### Existing docker-compose.yml
The existing file is **compatible with Podman**! Key adjustments:

1. **Ports are already unprivileged** (3000, 3002, 8000, 8080, 3100)
2. **Named volumes work** (frontend_node_modules, admin_node_modules)
3. **Network mode works** (bridge is default)

### Override for Podman
Create `podman-compose.override.yml`:
```yaml
x-podman:
  default_net_behavior_compat: true
  default_net_name_compat: true

services:
  frontend:
    # Remove root user - not needed with Podman
    user: ""
```

## Gotchas

### 1. Docker Socket Access
Admin panel mounts `/var/run/docker.sock` for container management.
For Podman, use:
```yaml
volumes:
  - /run/user/1000/podman/podman.sock:/var/run/docker.sock
```

### 2. Image Naming
Podman may add registry prefix. Use full image names:
```yaml
image: docker.io/library/node:20-alpine
# Instead of: node:20-alpine
```

### 3. Build Context
Same as Docker - works identically.

### 4. Health Checks
Identical to Docker - no changes needed.

## Commands Comparison

| Docker | Podman | Notes |
|--------|--------|-------|
| `docker ps` | `podman ps` | Identical |
| `docker-compose up` | `podman-compose up` | Or `podman compose up` |
| `docker build` | `podman build` | Identical |
| `docker logs` | `podman logs` | Identical |
| `docker exec` | `podman exec` | Identical |
| `docker run` | `podman run` | Identical |

## Recommended Workflow

For GOGGA development:

```bash
# Backend services in Podman (rootless)
podman-compose up -d backend cepo admin

# Frontend local (fastest iteration)
cd gogga-frontend && pnpm dev

# No more permission issues!
```

## Rollback

If issues arise, Docker still works:
```bash
# Stop Podman
podman-compose down

# Clean up
sudo rm -rf gogga-frontend/.next

# Resume Docker
docker compose up -d
```

## Related Memories
- `docker_best_practices.md` - Why node_modules volumes are needed
- `distributed_infrastructure.md` - Two-server setup
- `network_configuration.md` - LAN IP detection
