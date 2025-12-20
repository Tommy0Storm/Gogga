#!/bin/bash
# =============================================================================
# GOGGA Distributed Setup - Step 2: NFS Mount Configuration
# =============================================================================
# Configures NFS server on worker (192.168.0.198) and client on primary
# Creates DEV-Drive shared folder for distributed development
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
NFS_SHARE="/home/hybridwolvin/DEV-Drive"
MOUNT_POINT="/mnt/dev-drive"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GOGGA Distributed - NFS Setup${NC}"
echo -e "${BLUE}============================================${NC}"

# =============================================================================
# WORKER (NFS SERVER) CONFIGURATION
# =============================================================================
echo -e "\n${YELLOW}[1/6]${NC} Installing NFS server on worker..."
ssh gogga-worker << 'REMOTE_SERVER_SCRIPT'
set -e

# Install NFS server
if ! command -v exportfs &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y nfs-kernel-server
fi
echo "✓ NFS server installed"

# Create shared directory
DEV_DRIVE="/home/hybridwolvin/DEV-Drive"
mkdir -p "$DEV_DRIVE"
chmod 755 "$DEV_DRIVE"
echo "✓ DEV-Drive directory created at $DEV_DRIVE"

# Create subdirectories for Docker and projects
mkdir -p "$DEV_DRIVE/docker"
mkdir -p "$DEV_DRIVE/projects"
mkdir -p "$DEV_DRIVE/shared-data"
echo "✓ Subdirectories created"

REMOTE_SERVER_SCRIPT

echo -e "${GREEN}✓${NC} Worker NFS server base setup complete"

# Configure NFS exports
echo -e "\n${YELLOW}[2/6]${NC} Configuring NFS exports on worker..."
ssh gogga-worker << REMOTE_EXPORTS
set -e

# Add export if not already present
EXPORTS_LINE="${NFS_SHARE} ${PRIMARY_IP}(rw,sync,no_subtree_check,no_root_squash)"
if ! grep -q "${NFS_SHARE}" /etc/exports 2>/dev/null; then
    echo "\$EXPORTS_LINE" | sudo tee -a /etc/exports
    echo "✓ Added NFS export to /etc/exports"
else
    echo "✓ NFS export already configured"
fi

# Apply exports and restart NFS
sudo exportfs -ra
sudo systemctl enable nfs-kernel-server
sudo systemctl restart nfs-kernel-server
echo "✓ NFS server restarted and enabled"

# Configure firewall for NFS (if ufw is active)
if sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow from ${PRIMARY_IP} to any port nfs
    sudo ufw allow from ${PRIMARY_IP} to any port 111
    sudo ufw allow from ${PRIMARY_IP} to any port 2049
    echo "✓ Firewall configured for NFS"
fi
REMOTE_EXPORTS

echo -e "${GREEN}✓${NC} Worker NFS exports configured"

# =============================================================================
# PRIMARY (NFS CLIENT) CONFIGURATION
# =============================================================================
echo -e "\n${YELLOW}[3/6]${NC} Installing NFS client on primary..."
if ! command -v mount.nfs &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y nfs-common
fi
echo -e "${GREEN}✓${NC} NFS client installed"

echo -e "\n${YELLOW}[4/6]${NC} Creating mount point..."
sudo mkdir -p "$MOUNT_POINT"
sudo chown ubuntu:ubuntu "$MOUNT_POINT"
echo -e "${GREEN}✓${NC} Mount point created at $MOUNT_POINT"

echo -e "\n${YELLOW}[5/6]${NC} Configuring permanent NFS mount..."

# Add fstab entry if not already present
FSTAB_ENTRY="${WORKER_IP}:${NFS_SHARE} ${MOUNT_POINT} nfs defaults,_netdev,auto,nofail,x-systemd.automount,x-systemd.device-timeout=10 0 0"

if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    echo "$FSTAB_ENTRY" | sudo tee -a /etc/fstab
    echo -e "${GREEN}✓${NC} Added NFS mount to /etc/fstab"
else
    echo -e "${GREEN}✓${NC} NFS mount already in /etc/fstab"
fi

# Create systemd mount unit for reliable auto-mount
echo -e "\n${YELLOW}[6/6]${NC} Creating systemd mount units..."

# Create mount unit
sudo tee /etc/systemd/system/mnt-dev\\x2ddrive.mount << EOF
[Unit]
Description=GOGGA Worker DEV-Drive NFS Mount
Documentation=man:systemd.mount(5)
Requires=network-online.target
After=network-online.target
Wants=remote-fs-pre.target
Before=remote-fs.target

[Mount]
What=${WORKER_IP}:${NFS_SHARE}
Where=${MOUNT_POINT}
Type=nfs
Options=defaults,_netdev,nofail,x-systemd.device-timeout=15,timeo=14,hard,retrans=3

[Install]
WantedBy=multi-user.target
WantedBy=remote-fs.target
EOF

# Create automount unit for on-demand mounting
sudo tee /etc/systemd/system/mnt-dev\\x2ddrive.automount << EOF
[Unit]
Description=GOGGA Worker DEV-Drive Automount
Documentation=man:systemd.automount(5)
Requires=network-online.target
After=network-online.target

[Automount]
Where=${MOUNT_POINT}
TimeoutIdleSec=0

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable mount
sudo systemctl daemon-reload
sudo systemctl enable mnt-dev\\x2ddrive.automount
sudo systemctl start mnt-dev\\x2ddrive.automount

echo -e "${GREEN}✓${NC} Systemd mount units created and enabled"

# Test mount
echo -e "\n${YELLOW}Testing NFS mount...${NC}"
sudo mount -a
if mountpoint -q "$MOUNT_POINT"; then
    echo -e "${GREEN}✓${NC} NFS mount successful!"
    echo -e "  Contents of $MOUNT_POINT:"
    ls -la "$MOUNT_POINT"
else
    echo -e "${YELLOW}!${NC} Mount point not active yet. Accessing it will trigger automount."
    # Force access to trigger automount
    ls "$MOUNT_POINT" 2>/dev/null || true
fi

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  NFS Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "Mount point: ${BLUE}${MOUNT_POINT}${NC}"
echo -e "Remote path: ${BLUE}${WORKER_IP}:${NFS_SHARE}${NC}"
echo -e "\nMount will persist across reboots."
