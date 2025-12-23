#!/bin/bash
# =============================================================================
# GOGGA NVMe Optimization Script
# =============================================================================
# Run on both Mac servers (192.168.0.130 and 192.168.0.198)
# Optimizes fast NVMe storage (430MB/s read, 200+MB/s write)
# Creates cache directories for Docker services
# =============================================================================

set -e

echo "=== GOGGA NVMe Optimization ==="
echo "Hostname: $(hostname)"
echo "Date: $(date)"
echo ""

# Detect which node we're on
HOSTNAME=$(hostname)
NODE_IP=$(hostname -I | awk '{print $1}')
echo "Node IP: $NODE_IP"

# 0. Create Gogga cache directories (NVMe-backed)
echo ""
echo "0. Creating Gogga cache directories..."
CACHE_DIR="/opt/gogga-cache"
sudo mkdir -p "$CACHE_DIR"
sudo chown -R $USER:$USER "$CACHE_DIR"

# Create subdirectories based on node role
if [[ "$NODE_IP" == *"130"* ]]; then
    echo "   Detected PRIMARY node (192.168.0.130)"
    mkdir -p "$CACHE_DIR"/{frontend-data,backend-logs,nginx}
    echo "   Created: frontend-data, backend-logs, nginx"
elif [[ "$NODE_IP" == *"198"* ]]; then
    echo "   Detected WORKER node (192.168.0.198)"
    mkdir -p "$CACHE_DIR"/{cepo,chroma,redis,processed}
    echo "   Created: cepo, chroma, redis, processed"
else
    echo "   Unknown node - creating all directories"
    mkdir -p "$CACHE_DIR"/{frontend-data,backend-logs,nginx,cepo,chroma,redis,processed}
fi

echo "   Cache directory: $CACHE_DIR ✓"
ls -la "$CACHE_DIR"
echo ""

# Find NVMe or fast SSD device
find_fast_disk() {
    # First try NVMe
    if ls /dev/nvme* 2>/dev/null | head -1 | grep -q nvme; then
        lsblk -d -o NAME,ROTA | grep " 0" | grep nvme | head -1 | awk '{print $1}'
        return
    fi
    
    # Then try SSD (non-rotational)
    lsblk -d -o NAME,ROTA | grep " 0" | grep -v loop | head -1 | awk '{print $1}'
}

DISK_DEV=$(find_fast_disk)

if [ -z "$DISK_DEV" ]; then
    echo "⚠️  No NVMe/SSD device found. Checking all block devices..."
    lsblk -d -o NAME,ROTA,SIZE,MODEL
    echo ""
    echo "Continuing with other optimizations..."
    DISK_DEV="sda"  # Fallback for systems without detectable SSD
fi

echo "1. Found disk: /dev/$DISK_DEV"
echo ""

# 1. Set I/O Scheduler to none/noop (lowest latency for NVMe)
echo "2. Setting I/O scheduler..."
SCHEDULER_PATH="/sys/block/$DISK_DEV/queue/scheduler"
if [ -f "$SCHEDULER_PATH" ]; then
    CURRENT=$(cat "$SCHEDULER_PATH")
    echo "   Current: $CURRENT"
    
    # Try 'none' first (modern kernels), then 'noop' (older)
    if echo "none" | sudo tee "$SCHEDULER_PATH" 2>/dev/null; then
        echo "   Set to: none ✓"
    elif echo "noop" | sudo tee "$SCHEDULER_PATH" 2>/dev/null; then
        echo "   Set to: noop ✓"
    else
        echo "   ⚠️  Could not change scheduler"
    fi
else
    echo "   ⚠️  Scheduler file not found"
fi

# 2. Increase readahead for sequential workloads
echo ""
echo "3. Setting readahead..."
CURRENT_RA=$(sudo blockdev --getra /dev/$DISK_DEV)
echo "   Current: $CURRENT_RA"
if sudo blockdev --setra 4096 /dev/$DISK_DEV; then
    echo "   Set to: 4096 ✓"
else
    echo "   ⚠️  Could not set readahead"
fi

# 3. Set I/O affinity (reduces CPU overhead)
echo ""
echo "4. Setting I/O affinity..."
AFFINITY_PATH="/sys/block/$DISK_DEV/queue/rq_affinity"
if [ -f "$AFFINITY_PATH" ]; then
    CURRENT=$(cat "$AFFINITY_PATH")
    echo "   Current: $CURRENT"
    if echo 2 | sudo tee "$AFFINITY_PATH" > /dev/null; then
        echo "   Set to: 2 ✓"
    fi
fi

# 4. Enable TRIM if available (for SSD health)
echo ""
echo "5. Checking TRIM support..."
if sudo fstrim -v / 2>/dev/null; then
    echo "   TRIM executed ✓"
    
    # Enable periodic TRIM
    if ! systemctl is-enabled fstrim.timer 2>/dev/null; then
        sudo systemctl enable fstrim.timer
        sudo systemctl start fstrim.timer
        echo "   fstrim.timer enabled ✓"
    fi
else
    echo "   ⚠️  TRIM not available or failed"
fi

# 5. Check current mount options
echo ""
echo "6. Current mount options for root filesystem:"
mount | grep " / " | head -1

# 6. Recommend noatime if not set
echo ""
echo "7. Recommendation:"
if mount | grep " / " | grep -q noatime; then
    echo "   ✓ noatime already enabled"
else
    echo "   ⚠️  Consider adding 'noatime' to /etc/fstab for root partition"
    echo "   This reduces write operations for better performance"
fi

# 7. Create persistent optimization via udev rule
echo ""
echo "8. Creating persistent udev rule..."
UDEV_RULE="/etc/udev/rules.d/60-nvme-scheduler.rules"
cat <<EOF | sudo tee "$UDEV_RULE" > /dev/null
# GOGGA NVMe optimization - low latency scheduler
ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/scheduler}="none"
ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/rotational}=="0", ATTR{queue/scheduler}="none"
EOF
echo "   Created: $UDEV_RULE ✓"

# Reload udev rules
sudo udevadm control --reload-rules
echo "   Udev rules reloaded ✓"

# 8. Docker storage optimization
echo ""
echo "9. Docker storage check..."
if [ -f /etc/docker/daemon.json ]; then
    echo "   Docker daemon.json exists:"
    cat /etc/docker/daemon.json
else
    echo "   Creating optimized Docker daemon.json..."
    sudo mkdir -p /etc/docker
    cat <<EOF | sudo tee /etc/docker/daemon.json > /dev/null
{
    "storage-driver": "overlay2",
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ],
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF
    echo "   Created /etc/docker/daemon.json ✓"
    echo "   ⚠️  Restart Docker to apply: sudo systemctl restart docker"
fi

# Final summary
echo ""
echo "=== Optimization Complete ==="
echo ""
echo "Disk: /dev/$DISK_DEV"
echo "Scheduler: $(cat /sys/block/$DISK_DEV/queue/scheduler 2>/dev/null || echo 'N/A')"
echo "Readahead: $(sudo blockdev --getra /dev/$DISK_DEV 2>/dev/null || echo 'N/A')"
echo "Affinity: $(cat /sys/block/$DISK_DEV/queue/rq_affinity 2>/dev/null || echo 'N/A')"
echo ""
echo "Cache directories created in: $CACHE_DIR"
ls -la "$CACHE_DIR" 2>/dev/null || echo "  (none)"
echo ""
echo "=== Disk Benchmark Command ==="
echo "Run: sudo fio --name=test --size=1G --rw=randread --bs=4k --direct=1 --numjobs=4 --runtime=10"
echo ""
echo "=== Next Steps ==="
if [[ "$NODE_IP" == *"130"* ]]; then
    echo "1. Deploy primary services: docker compose -f docker-compose.primary.yml up -d"
elif [[ "$NODE_IP" == *"198"* ]]; then
    echo "1. Deploy worker services: docker compose -f docker-compose.worker.yml up -d"
fi
echo "2. Mount NFS share if needed: sudo mount -t nfs 192.168.0.198:/mnt/dev-drive /mnt/dev-drive"
echo ""
