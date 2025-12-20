#!/bin/bash
# =============================================================================
# GOGGA Distributed Setup - Step 3: Docker Installation on Worker
# =============================================================================
# Installs Docker on the worker server (192.168.0.198)
# Configures Docker to accept remote connections securely
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
PRIMARY_IP="192.168.0.130"
DOCKER_PORT="2376"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GOGGA Distributed - Docker Worker Setup${NC}"
echo -e "${BLUE}============================================${NC}"

# =============================================================================
# INSTALL DOCKER ON WORKER
# =============================================================================
echo -e "\n${YELLOW}[1/5]${NC} Installing Docker on worker..."
ssh gogga-worker << 'REMOTE_DOCKER_INSTALL'
set -e

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "✓ Docker already installed: $(docker --version)"
else
    echo "Installing Docker..."
    
    # Remove old versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install prerequisites
    sudo apt-get update
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    echo "✓ Docker installed: $(docker --version)"
fi

# Add user to docker group
sudo usermod -aG docker $USER
echo "✓ User added to docker group"

REMOTE_DOCKER_INSTALL

echo -e "${GREEN}✓${NC} Docker installed on worker"

# =============================================================================
# CONFIGURE DOCKER FOR REMOTE ACCESS
# =============================================================================
echo -e "\n${YELLOW}[2/5]${NC} Configuring Docker for remote access..."
ssh gogga-worker << REMOTE_DOCKER_CONFIG
set -e

# Create Docker TLS directory
sudo mkdir -p /etc/docker/certs

# Create Docker daemon configuration
sudo tee /etc/docker/daemon.json << EOF
{
    "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:${DOCKER_PORT}"],
    "tls": false,
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "100m",
        "max-file": "3"
    },
    "default-address-pools": [
        {
            "base": "172.20.0.0/16",
            "size": 24
        }
    ],
    "storage-driver": "overlay2"
}
EOF

echo "✓ Docker daemon configured for remote access"

# Override systemd to not pass -H flag (conflicts with daemon.json hosts)
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/override.conf << EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd
EOF

echo "✓ Systemd override created"
REMOTE_DOCKER_CONFIG

echo -e "${GREEN}✓${NC} Docker remote access configured"

# =============================================================================
# CONFIGURE FIREWALL ON WORKER
# =============================================================================
echo -e "\n${YELLOW}[3/5]${NC} Configuring firewall on worker..."
ssh gogga-worker << REMOTE_FIREWALL
set -e

# Allow Docker port from primary only
if sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow from ${PRIMARY_IP} to any port ${DOCKER_PORT}
    echo "✓ Firewall rule added for Docker remote access"
else
    echo "✓ UFW not active, skipping firewall configuration"
fi
REMOTE_FIREWALL

echo -e "${GREEN}✓${NC} Firewall configured"

# =============================================================================
# RESTART DOCKER ON WORKER
# =============================================================================
echo -e "\n${YELLOW}[4/5]${NC} Restarting Docker on worker..."
ssh gogga-worker << 'REMOTE_DOCKER_RESTART'
set -e
sudo systemctl daemon-reload
sudo systemctl enable docker
sudo systemctl restart docker
sleep 3
docker info > /dev/null 2>&1 && echo "✓ Docker service running" || echo "✗ Docker failed to start"
REMOTE_DOCKER_RESTART

echo -e "${GREEN}✓${NC} Docker restarted and enabled for auto-start"

# =============================================================================
# CREATE DEV-DRIVE DOCKER DIRECTORIES
# =============================================================================
echo -e "\n${YELLOW}[5/5]${NC} Setting up Docker directories on DEV-Drive..."
ssh gogga-worker << 'REMOTE_DOCKER_DIRS'
set -e
DEV_DRIVE="/home/hybridwolvin/DEV-Drive"

# Create Docker working directories
mkdir -p "$DEV_DRIVE/docker/volumes"
mkdir -p "$DEV_DRIVE/docker/compose"
mkdir -p "$DEV_DRIVE/docker/logs"
mkdir -p "$DEV_DRIVE/docker/data"

echo "✓ Docker directories created on DEV-Drive"
ls -la "$DEV_DRIVE/docker/"
REMOTE_DOCKER_DIRS

echo -e "${GREEN}✓${NC} DEV-Drive Docker directories ready"

# =============================================================================
# TEST REMOTE CONNECTION
# =============================================================================
echo -e "\n${YELLOW}Testing remote Docker connection...${NC}"
sleep 2
if docker -H tcp://${WORKER_IP}:${DOCKER_PORT} info > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Remote Docker connection working!"
    docker -H tcp://${WORKER_IP}:${DOCKER_PORT} version
else
    echo -e "${YELLOW}!${NC} Remote connection not yet ready. May need a moment after restart."
fi

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  Docker Worker Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "Test command: ${BLUE}docker -H tcp://${WORKER_IP}:${DOCKER_PORT} ps${NC}"
