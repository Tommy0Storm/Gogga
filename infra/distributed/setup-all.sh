#!/bin/bash
# =============================================================================
# GOGGA Distributed Setup - Master Orchestrator
# =============================================================================
# Runs all setup steps in order with validation between steps
# Usage: ./setup-all.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_IP="192.168.0.198"
PRIMARY_IP="192.168.0.130"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                                                                      ║"
echo "║     ██████╗  ██████╗  ██████╗  ██████╗  █████╗                      ║"
echo "║    ██╔════╝ ██╔═══██╗██╔════╝ ██╔════╝ ██╔══██╗                     ║"
echo "║    ██║  ███╗██║   ██║██║  ███╗██║  ███╗███████║                     ║"
echo "║    ██║   ██║██║   ██║██║   ██║██║   ██║██╔══██║                     ║"
echo "║    ╚██████╔╝╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║                     ║"
echo "║     ╚═════╝  ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝                     ║"
echo "║                                                                      ║"
echo "║               DISTRIBUTED INFRASTRUCTURE SETUP                       ║"
echo "║                                                                      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Primary Server: ${GREEN}${PRIMARY_IP}${NC} (this machine)"
echo -e "  Worker Server:  ${GREEN}${WORKER_IP}${NC} (Apple Mac Ubuntu)"
echo -e "  Worker User:    ${GREEN}hybridwolvin${NC}"
echo ""

# Ensure scripts are executable
chmod +x "$SCRIPT_DIR"/*.sh

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================
echo -e "${YELLOW}[PRE-FLIGHT] Running connectivity checks...${NC}"

# Check worker is reachable
if ! ping -c 1 -W 3 "$WORKER_IP" > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Cannot reach worker at $WORKER_IP"
    echo -e "${YELLOW}  Please ensure the worker server is powered on and connected.${NC}"
    echo ""
    echo -e "Once worker is online, run: ${BLUE}./setup-all.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Worker reachable"

# Create ~/bin if it doesn't exist
mkdir -p ~/bin

# =============================================================================
# STEP 1: SSH SETUP
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STEP 1: SSH Key Configuration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
"$SCRIPT_DIR/01-setup-ssh.sh"

# Validate SSH works before continuing
if ! ssh -o ConnectTimeout=5 gogga-worker "echo 'SSH OK'" > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} SSH validation failed. Please check and retry."
    exit 1
fi

# =============================================================================
# STEP 2: NFS MOUNT
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STEP 2: NFS Mount Configuration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
"$SCRIPT_DIR/02-setup-nfs.sh"

# Validate NFS mount
sleep 2
if ! ls /mnt/dev-drive > /dev/null 2>&1; then
    echo -e "${YELLOW}!${NC} NFS mount not immediately accessible. May auto-mount on first access."
fi

# =============================================================================
# STEP 3: DOCKER ON WORKER
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STEP 3: Docker Installation on Worker${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
"$SCRIPT_DIR/03-setup-docker-worker.sh"

# Wait for Docker to be ready
sleep 3

# =============================================================================
# STEP 4: DOCKER CONTEXTS
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STEP 4: Docker Context Configuration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
"$SCRIPT_DIR/04-setup-docker-context.sh"

# =============================================================================
# STEP 5: DEPLOY WORKERS
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  STEP 5: Deploy Worker Containers${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
"$SCRIPT_DIR/05-deploy-workers.sh"

# =============================================================================
# FINAL SUMMARY
# =============================================================================
echo ""
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    SETUP COMPLETE! 🎉                                ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}Distributed Infrastructure Summary:${NC}"
echo ""
echo -e "${BLUE}PRIMARY SERVER (192.168.0.130):${NC}"
echo -e "  ├─ Frontend:     http://192.168.0.130:3000"
echo -e "  ├─ Backend API:  http://192.168.0.130:8000"
echo -e "  ├─ Admin Panel:  http://192.168.0.130:3100"
echo -e "  ├─ Proxy:        https://192.168.0.130:3001"
echo -e "  └─ NFS Client:   /mnt/dev-drive"
echo ""
echo -e "${BLUE}WORKER SERVER (192.168.0.198):${NC}"
echo -e "  ├─ CePO:         http://192.168.0.198:8080"
echo -e "  ├─ cAdvisor:     http://192.168.0.198:8081"
echo -e "  ├─ NFS Server:   /home/hybridwolvin/DEV-Drive"
echo -e "  └─ Docker API:   tcp://192.168.0.198:2376"
echo ""
echo -e "${BLUE}Quick Commands:${NC}"
echo -e "  ${YELLOW}docker --context gogga-worker ps${NC}   - View worker containers"
echo -e "  ${YELLOW}docker --context gogga-primary ps${NC}  - View primary containers"
echo -e "  ${YELLOW}ssh gogga-worker${NC}                   - SSH to worker"
echo -e "  ${YELLOW}ls /mnt/dev-drive${NC}                  - Access shared storage"
echo ""
echo -e "${GREEN}Auto-start configured:${NC}"
echo -e "  ✓ NFS mount persists across reboots (systemd automount)"
echo -e "  ✓ Docker services restart automatically (unless-stopped)"
echo -e "  ✓ Docker daemon enabled on both servers"
echo ""
echo -e "Run ${YELLOW}source ~/.bashrc${NC} to activate shell aliases."
