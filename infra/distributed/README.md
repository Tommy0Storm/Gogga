# GOGGA Distributed Infrastructure

## Overview

This directory contains scripts and configuration for running GOGGA across two servers:

| Server | IP | Role | Hostname |
|--------|-----|------|----------|
| **Primary** | 192.168.0.130 | Frontend, Backend, Admin, VS Code host | gogga-primary |
| **Worker** | 192.168.0.198 | CePO, AI-intensive containers, DEV-Drive | gogga-worker |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Windows Host (10.0.0.1)                              │
│                         VS Code → SSH to Primary                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                              ▼
    ┌────────────────────────────────┐    ┌─────────────────────────────────┐
    │   PRIMARY (192.168.0.130)       │    │   WORKER (192.168.0.198)        │
    │   gogga-primary                 │    │   gogga-worker                  │
    ├─────────────────────────────────┤    ├─────────────────────────────────┤
    │ • Frontend (3000)               │◄───│ • NFS Server: DEV-Drive         │
    │ • Backend API (8000)            │    │ • CePO sidecar (8080)           │
    │ • Admin Panel (3100)            │    │ • Heavy AI workloads            │
    │ • Proxy (3001)                  │    │ • More RAM/CPU for inference    │
    │ • Docker control (VS Code)      │    │ • Docker remote API (2376)      │
    │ • NFS Client: /mnt/dev-drive    │    │                                 │
    └────────────────────────────────┘    └─────────────────────────────────┘
                     │                              │
                     └──────────── NFS ─────────────┘
```

## Quick Setup

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
