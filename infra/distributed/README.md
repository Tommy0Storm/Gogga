# GOGGA Distributed Infrastructure

## Overview

GOGGA runs across **two Mac Minis (8GB RAM each)** running Ubuntu with fast NVMe storage:

| Server | IP | Hardware | Disk Performance | Role |
|--------|-----|----------|------------------|------|
| **Primary** | 192.168.0.130 | Mac (Ubuntu) | NVMe 430/200+ MB/s | Frontend, Backend, Admin |
| **Worker** | 192.168.0.198 | Mac (Ubuntu) | NVMe 430/200+ MB/s | CePO, ChromaDB, Redis, Doc Processing |

**Development Machine**: Dell Latitude 5520 on 192.168.0.x network with VS Code (SSH to both servers)

## Architecture

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
    │   NVMe: 430/200+ MB/s           │    │   NVMe: 430/200+ MB/s           │
    ├─────────────────────────────────┤    ├─────────────────────────────────┤
    │ • Frontend (3000)               │◄───│ • CePO/OptiLLM (8080)           │
    │ • Backend API (8000)            │    │ • ChromaDB (8001)               │
    │ • Admin Panel (3100)            │    │ • Redis (6379)                  │
    │ • Nginx Proxy (443/80)          │    │ • Document Processor (8004)     │
    │ • NFS Client: /mnt/dev-drive    │    │ • NFS Server: DEV-Drive         │
    │ • Docker control (VS Code)      │    │ • cAdvisor (8081)               │
    └────────────────────────────────┘    └─────────────────────────────────┘
                     │                              │
                     └──────────── NFS ─────────────┘
```

## Quick Start

```bash
# From primary (192.168.0.130) or Dell via SSH
cd /home/ubuntu/Dev-Projects/Gogga/infra/distributed

# Deploy all nodes
./deploy.sh all

# Or deploy individually
./deploy.sh primary
./deploy.sh worker

# Check status
./deploy.sh status

# Run benchmark
./deploy.sh benchmark
```

## Quick Setup (First Time)

Run the master setup script from the primary server:

```bash
# From 192.168.0.130 (primary)
cd /home/ubuntu/Dev-Projects/Gogga/infra/distributed
chmod +x setup-all.sh
./setup-all.sh
```

## Manual Setup Steps

1. **SSH Key Setup** - `./01-setup-ssh.sh`
2. **NFS Mount** - `./02-setup-nfs.sh`
3. **Docker on Worker** - `./03-setup-docker-worker.sh`
4. **Docker Context** - `./04-setup-docker-context.sh`
5. **Deploy Workers** - `./05-deploy-workers.sh`

## Auto-Start Configuration

All services are configured to auto-start on reboot via:
- systemd services for NFS mounts
- Docker restart policies (`unless-stopped`)
- systemd service for Docker daemon

## Directory Structure

```
infra/distributed/
├── README.md                    # This file
├── setup-all.sh                 # Master orchestrator
├── 01-setup-ssh.sh              # SSH key setup
├── 02-setup-nfs.sh              # NFS client/server config
├── 03-setup-docker-worker.sh    # Docker installation on worker
├── 04-setup-docker-context.sh   # Docker contexts for remote control
├── 05-deploy-workers.sh         # Deploy containers to worker
├── docker-compose.worker.yml    # Worker node compose file
├── configs/
│   ├── nfs-exports              # NFS server exports config
│   ├── nfs-fstab                # NFS client fstab entry
│   └── docker-daemon.json       # Docker daemon config for remote
└── systemd/
    ├── mnt-dev-drive.mount      # Systemd mount unit
    └── mnt-dev-drive.automount  # Automount unit
```

## Monitoring

```bash
# Check worker containers from primary
docker --context gogga-worker ps

# Check NFS mount
mount | grep dev-drive

# Check all services
./status.sh
```
