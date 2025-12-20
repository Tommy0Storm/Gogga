# Network Configuration for Gogga Development

## Overview (Dec 2025)

GOGGA runs across a **distributed two-server infrastructure** with a Windows development machine:

| Machine | IP | Role | Hostname |
|---------|-----|------|----------|
| **Windows (VS Code)** | 10.0.0.1 | Development IDE, SSH to Primary | N/A |
| **Primary (Ubuntu)** | 192.168.0.130 | Frontend, Backend, Admin, VS Code SSH target | ubuntu-MacBookPro12-1 |
| **Worker (Ubuntu)** | 192.168.0.198 | CePO, AI workloads, NFS Server | hybridwolvin-MacBookPro11-2 |

## Network Topology

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Windows Host (10.0.0.1)                                 │
│                      VS Code Remote SSH                                      │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ SSH (10.0.0.1 → 10.0.0.1:22 / eth)
                 ┌──────────────┴──────────────┐
                 ▼                              │
┌────────────────────────────────┐             │ Docker Context
│   PRIMARY (192.168.0.130)       │             │ + SSH (passwordless)
│   ubuntu-MacBookPro12-1         │             │
├─────────────────────────────────┤             ▼
│ Interfaces:                     │    ┌─────────────────────────────────┐
│ • wlp3s0: 192.168.0.130 (WiFi)  │    │   WORKER (192.168.0.198)        │
│ • ens9: 10.0.0.1 (Ethernet)     │    │   hybridwolvin-MacBookPro11-2   │
│ • zt2lr3hxxc: 10.241.135.171    │    ├─────────────────────────────────┤
│ • docker0: 172.17.0.1           │    │ Resources:                      │
│                                 │    │ • 8 CPU cores                   │
│ Docker Containers:              │    │ • 7.7GB RAM                     │
│ • Frontend (:3000)              │    │ • 200GB disk (18GB used)        │
│ • Backend (:8000)               │◄───│                                 │
│ • Admin (:3100)                 │NFS │ Docker Containers:              │
│ • Proxy (:3001)                 │    │ • CePO (:8080)                  │
│                                 │    │ • cAdvisor (:8081)              │
│ NFS Mount: /mnt/dev-drive       │    │                                 │
│ Docker Context: controls both   │    │ NFS Export: ~/DEV-Drive         │
└────────────────────────────────┘    └─────────────────────────────────┘
\`\`\`

## Primary Server (192.168.0.130)

### Network Interfaces
- **WiFi (wlp3s0)**: \`192.168.0.130\` - DHCP, may change on reboot
- **Ethernet (ens9)**: \`10.0.0.1\` - Windows VS Code connects here
- **ZeroTier (zt2lr3hxxc)**: \`10.241.135.171\` - Remote access
- **Docker Bridge**: \`172.17.0.1\`, \`172.18.0.1\`

### Services
| Service | Port | URL | Protocol |
|---------|------|-----|----------|
| Frontend | 3000 | https://192.168.0.130:3000 | HTTPS |
| Backend API | 8000 | http://192.168.0.130:8000 | HTTP |
| Admin Panel | 3100 | http://192.168.0.130:3100 | HTTP |
| HTTPS Proxy | 3001 | https://192.168.0.130:3001 | HTTPS |

## Worker Server (192.168.0.198)

### Resources
- **CPU**: 8 cores
- **RAM**: 7.7GB (4.3GB used typical)
- **Disk**: 228GB total, 200GB available
- **OS**: Ubuntu 24.04 (kernel 6.14.0-37)

### Services
| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| CePO | 8080 | http://192.168.0.198:8080 | OptiLLM optimization |
| cAdvisor | 8081 | http://192.168.0.198:8081 | Container monitoring |
| Docker API | 2376 | tcp://192.168.0.198:2376 | Remote Docker control |
| NFS | 2049 | - | Shared storage |

## SSH Configuration

### Windows → Primary
VS Code Remote SSH connection:
\`\`\`
Host: 10.0.0.1 (ethernet interface)
User: ubuntu
\`\`\`

### Primary → Worker (Passwordless)
\`\`\`bash
# ~/.ssh/config on primary
Host gogga-worker
    HostName 192.168.0.198
    User hybridwolvin
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking no

# Quick connect
ssh gogga-worker
\`\`\`

## Docker Contexts

Control Docker on both servers from primary:

\`\`\`bash
# List available contexts
docker context ls

# Use primary (default)
docker --context gogga-primary ps

# Use worker
docker --context gogga-worker ps

# Shell aliases (add to ~/.bashrc)
alias dp='docker --context gogga-primary'
alias dw='docker --context gogga-worker'
\`\`\`

## NFS Shared Storage

### Mount Configuration
- **Primary mount point**: \`/mnt/dev-drive\`
- **Worker export path**: \`/home/hybridwolvin/DEV-Drive\`

### Directory Structure
\`\`\`
DEV-Drive/
├── docker/
│   ├── compose/      # Worker compose files
│   ├── volumes/      # Persistent container data
│   ├── logs/         # Container logs
│   └── data/         # Application data
├── projects/         # Shared project files
├── shared-data/      # Cross-server shared data
└── gogga-config/     # Copied config files (.env)
\`\`\`

### fstab Entry (Primary)
\`\`\`
192.168.0.198:/home/hybridwolvin/DEV-Drive  /mnt/dev-drive  nfs  defaults,_netdev,x-systemd.automount  0  0
\`\`\`

## Next.js 16 LAN Access Bug

Next.js 16 has a bug where the dev server only accepts localhost connections even when bound to \`0.0.0.0\`.

**Solution**: Bind to specific LAN IP instead of \`0.0.0.0\`.

### Auto-Update Script
\`gogga-frontend/scripts/update-lan-ip.sh\` automatically detects LAN IP and updates:
1. \`.env.local\` - \`NEXT_PUBLIC_BASE_URL\` and \`NEXTAUTH_URL\`
2. \`package.json\` - \`dev\` script hostname

**Runs automatically via \`predev\` hook when running \`pnpm dev\`.**

### Dev Server Commands
\`\`\`bash
pnpm dev           # Auto-detects LAN IP, HTTPS
pnpm dev:localhost # Localhost only, HTTPS
pnpm dev:docker    # 0.0.0.0 binding, HTTPS
pnpm dev:http      # HTTP mode
\`\`\`

## Auto-Start Configuration

### Primary Server
- **Docker**: \`systemctl enable docker\`
- **Containers**: \`restart: unless-stopped\` policy
- **NFS Mount**: systemd automount unit

### Worker Server
- **Docker**: \`systemctl enable docker\`
- **Containers**: \`restart: unless-stopped\` policy
- **NFS Server**: \`systemctl enable nfs-kernel-server\`

## Key Configuration Files

| File | Server | Purpose |
|------|--------|---------|
| \`~/.ssh/config\` | Primary | SSH host aliases |
| \`/etc/fstab\` | Primary | NFS mount config |
| \`/etc/exports\` | Worker | NFS export config |
| \`~/.docker/contexts/\` | Primary | Docker contexts |
| \`infra/distributed/\` | Primary | Setup scripts |

## Troubleshooting

### IP Changed After Reboot
\`\`\`bash
# Update dev server binding
cd gogga-frontend && pnpm dev  # predev runs update script

# Check current IP
ip addr show | grep "inet " | grep wl
\`\`\`

### Worker Not Reachable
\`\`\`bash
ping 192.168.0.198
ssh gogga-worker hostname
\`\`\`

### NFS Mount Failed
\`\`\`bash
# Check NFS server on worker
ssh gogga-worker "systemctl status nfs-kernel-server"

# Remount
sudo mount -a

# Trigger automount
ls /mnt/dev-drive
\`\`\`

### Docker Context Not Working
\`\`\`bash
# Test remote Docker
docker -H tcp://192.168.0.198:2376 info

# Recreate context
docker context rm gogga-worker
docker context create gogga-worker --docker "host=tcp://192.168.0.198:2376"
\`\`\`

### HTTPS Certificate Issues
Self-signed certificates in \`gogga-frontend/certs/\`:
- Accept browser security warning to proceed
- Regenerate with: \`openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365\`
