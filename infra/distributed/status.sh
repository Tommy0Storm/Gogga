#!/bin/bash
# =============================================================================
# GOGGA Distributed - Status Check
# =============================================================================
# Checks the status of all distributed services
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WORKER_IP="192.168.0.198"
PRIMARY_IP="192.168.0.130"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GOGGA Distributed - Status Check${NC}"
echo -e "${BLUE}============================================${NC}"

# Check Primary
echo -e "\n${YELLOW}PRIMARY SERVER (${PRIMARY_IP}):${NC}"
echo -e "──────────────────────────────────────────"

# Docker on primary
if docker info > /dev/null 2>&1; then
    echo -e "  Docker:        ${GREEN}✓ Running${NC}"
else
    echo -e "  Docker:        ${RED}✗ Not running${NC}"
fi

# Frontend
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "  Frontend:      ${GREEN}✓ http://localhost:3000${NC}"
else
    echo -e "  Frontend:      ${YELLOW}○ Not responding${NC}"
fi

# Backend
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "  Backend:       ${GREEN}✓ http://localhost:8000${NC}"
else
    echo -e "  Backend:       ${YELLOW}○ Not responding${NC}"
fi

# Admin
if curl -sf http://localhost:3100 > /dev/null 2>&1; then
    echo -e "  Admin:         ${GREEN}✓ http://localhost:3100${NC}"
else
    echo -e "  Admin:         ${YELLOW}○ Not responding${NC}"
fi

# NFS Mount
if mountpoint -q /mnt/dev-drive 2>/dev/null; then
    echo -e "  NFS Mount:     ${GREEN}✓ /mnt/dev-drive${NC}"
else
    echo -e "  NFS Mount:     ${YELLOW}○ Not mounted (access to trigger automount)${NC}"
fi

# Check Worker
echo -e "\n${YELLOW}WORKER SERVER (${WORKER_IP}):${NC}"
echo -e "──────────────────────────────────────────"

# Connectivity
if ping -c 1 -W 2 "$WORKER_IP" > /dev/null 2>&1; then
    echo -e "  Network:       ${GREEN}✓ Reachable${NC}"
else
    echo -e "  Network:       ${RED}✗ Unreachable${NC}"
    exit 0
fi

# SSH
if ssh -o ConnectTimeout=3 gogga-worker "echo OK" > /dev/null 2>&1; then
    echo -e "  SSH:           ${GREEN}✓ Connected${NC}"
else
    echo -e "  SSH:           ${RED}✗ Connection failed${NC}"
fi

# Docker on worker
if docker --context gogga-worker info > /dev/null 2>&1; then
    echo -e "  Docker:        ${GREEN}✓ Running${NC}"
else
    echo -e "  Docker:        ${YELLOW}○ Not accessible${NC}"
fi

# CePO on worker
if curl -sf "http://${WORKER_IP}:8080/health" > /dev/null 2>&1; then
    echo -e "  CePO:          ${GREEN}✓ http://${WORKER_IP}:8080${NC}"
else
    echo -e "  CePO:          ${YELLOW}○ Not responding${NC}"
fi

# cAdvisor on worker
if curl -sf "http://${WORKER_IP}:8081" > /dev/null 2>&1; then
    echo -e "  cAdvisor:      ${GREEN}✓ http://${WORKER_IP}:8081${NC}"
else
    echo -e "  cAdvisor:      ${YELLOW}○ Not responding${NC}"
fi

# NFS Server
if ssh -o ConnectTimeout=3 gogga-worker "systemctl is-active nfs-kernel-server" 2>/dev/null | grep -q "active"; then
    echo -e "  NFS Server:    ${GREEN}✓ Running${NC}"
else
    echo -e "  NFS Server:    ${YELLOW}○ Not running${NC}"
fi

# Container summary
echo -e "\n${YELLOW}CONTAINER SUMMARY:${NC}"
echo -e "──────────────────────────────────────────"
echo -e "${BLUE}Primary:${NC}"
docker --context gogga-primary ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (unable to list)"
echo -e "\n${BLUE}Worker:${NC}"
docker --context gogga-worker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  (unable to list)"

echo -e "\n${GREEN}Status check complete.${NC}"
