#!/bin/bash
# =============================================================================
# GOGGA Distributed Setup - Step 1: SSH Key Configuration
# =============================================================================
# Sets up passwordless SSH from primary (192.168.0.130) to worker (192.168.0.198)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_IP="192.168.0.198"
WORKER_USER="hybridwolvin"
SSH_KEY_PATH="$HOME/.ssh/id_ed25519_gogga_worker"
SSH_CONFIG="$HOME/.ssh/config"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GOGGA Distributed - SSH Key Setup${NC}"
echo -e "${BLUE}============================================${NC}"

# Step 1: Check if worker is reachable
echo -e "\n${YELLOW}[1/5]${NC} Checking worker connectivity..."
if ping -c 1 -W 3 "$WORKER_IP" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Worker at $WORKER_IP is reachable"
else
    echo -e "${RED}✗${NC} Worker at $WORKER_IP is not reachable"
    echo -e "${YELLOW}  Make sure the worker server is powered on and connected to the network${NC}"
    exit 1
fi

# Step 2: Generate SSH key if it doesn't exist
echo -e "\n${YELLOW}[2/5]${NC} Generating SSH key..."
if [ -f "$SSH_KEY_PATH" ]; then
    echo -e "${GREEN}✓${NC} SSH key already exists at $SSH_KEY_PATH"
else
    ssh-keygen -t ed25519 -N "" -f "$SSH_KEY_PATH" -C "gogga-primary-to-worker"
    echo -e "${GREEN}✓${NC} Generated new SSH key at $SSH_KEY_PATH"
fi

# Step 3: Copy SSH key to worker
echo -e "\n${YELLOW}[3/5]${NC} Copying SSH key to worker..."
echo -e "${BLUE}  You will be prompted for the password for ${WORKER_USER}@${WORKER_IP}${NC}"
ssh-copy-id -i "$SSH_KEY_PATH.pub" "${WORKER_USER}@${WORKER_IP}"
echo -e "${GREEN}✓${NC} SSH key copied to worker"

# Step 4: Configure SSH client for easy access
echo -e "\n${YELLOW}[4/5]${NC} Configuring SSH client..."

# Create .ssh directory if it doesn't exist
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# Add worker host configuration
if grep -q "Host gogga-worker" "$SSH_CONFIG" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} SSH config for gogga-worker already exists"
else
    cat >> "$SSH_CONFIG" << EOF

# GOGGA Worker Node - Auto-configured by setup script
Host gogga-worker
    HostName $WORKER_IP
    User $WORKER_USER
    IdentityFile $SSH_KEY_PATH
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
    ServerAliveInterval 60
    ServerAliveCountMax 3
EOF
    chmod 600 "$SSH_CONFIG"
    echo -e "${GREEN}✓${NC} Added gogga-worker to SSH config"
fi

# Step 5: Test connection
echo -e "\n${YELLOW}[5/5]${NC} Testing SSH connection..."
if ssh -o ConnectTimeout=5 gogga-worker "echo 'Connection successful' && hostname && uname -a"; then
    echo -e "${GREEN}✓${NC} SSH connection working!"
else
    echo -e "${RED}✗${NC} SSH connection failed"
    exit 1
fi

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  SSH Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "You can now connect with: ${BLUE}ssh gogga-worker${NC}"
