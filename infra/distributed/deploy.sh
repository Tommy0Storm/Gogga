#!/bin/bash
# =============================================================================
# GOGGA Distributed Deployment Script
# =============================================================================
# Deploys services to both Mac nodes from Dell VS Code machine
# Usage: ./deploy.sh [all|primary|worker|status|optimize]
# =============================================================================

set -e

# Configuration
PRIMARY_HOST="192.168.0.130"
WORKER_HOST="192.168.0.198"
PRIMARY_USER="${GOGGA_PRIMARY_USER:-ubuntu}"
WORKER_USER="${GOGGA_WORKER_USER:-ubuntu}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check SSH connectivity
check_ssh() {
    local host=$1
    local user=$2
    log_info "Checking SSH to $user@$host..."
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$host" "echo ok" > /dev/null 2>&1; then
        log_success "SSH to $host OK"
        return 0
    else
        log_error "Cannot SSH to $user@$host"
        return 1
    fi
}

# Run NVMe optimization on a node
optimize_node() {
    local host=$1
    local user=$2
    log_info "Optimizing NVMe on $host..."
    ssh "$user@$host" 'bash -s' < "$SCRIPT_DIR/optimize-nvme.sh"
    log_success "NVMe optimization complete on $host"
}

# Deploy to primary node (192.168.0.130)
deploy_primary() {
    log_info "Deploying to PRIMARY node ($PRIMARY_HOST)..."
    
    # Check SSH
    check_ssh "$PRIMARY_HOST" "$PRIMARY_USER" || return 1
    
    # Create directories
    ssh "$PRIMARY_USER@$PRIMARY_HOST" "mkdir -p ~/gogga-deploy"
    
    # Copy compose file
    log_info "Copying docker-compose.primary.yml..."
    scp "$SCRIPT_DIR/docker-compose.primary.yml" "$PRIMARY_USER@$PRIMARY_HOST:~/gogga-deploy/"
    
    # Copy nginx config if exists
    if [ -f "$SCRIPT_DIR/nginx-primary.conf" ]; then
        scp "$SCRIPT_DIR/nginx-primary.conf" "$PRIMARY_USER@$PRIMARY_HOST:~/gogga-deploy/"
    fi
    
    # Run optimization first
    optimize_node "$PRIMARY_HOST" "$PRIMARY_USER"
    
    # Deploy services
    log_info "Starting services on primary..."
    ssh "$PRIMARY_USER@$PRIMARY_HOST" "cd ~/gogga-deploy && docker compose -f docker-compose.primary.yml pull && docker compose -f docker-compose.primary.yml up -d"
    
    log_success "Primary node deployed"
    
    # Show status
    ssh "$PRIMARY_USER@$PRIMARY_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
}

# Deploy to worker node (192.168.0.198)
deploy_worker() {
    log_info "Deploying to WORKER node ($WORKER_HOST)..."
    
    # Check SSH
    check_ssh "$WORKER_HOST" "$WORKER_USER" || return 1
    
    # Create directories
    ssh "$WORKER_USER@$WORKER_HOST" "mkdir -p ~/gogga-deploy"
    
    # Copy compose file
    log_info "Copying docker-compose.worker.yml..."
    scp "$SCRIPT_DIR/docker-compose.worker.yml" "$WORKER_USER@$WORKER_HOST:~/gogga-deploy/"
    
    # Run optimization first
    optimize_node "$WORKER_HOST" "$WORKER_USER"
    
    # Deploy services
    log_info "Starting services on worker..."
    ssh "$WORKER_USER@$WORKER_HOST" "cd ~/gogga-deploy && docker compose -f docker-compose.worker.yml pull && docker compose -f docker-compose.worker.yml up -d"
    
    log_success "Worker node deployed"
    
    # Show status
    ssh "$WORKER_USER@$WORKER_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
}

# Show status of all nodes
show_status() {
    echo ""
    log_info "=== GOGGA Cluster Status ==="
    echo ""
    
    log_info "PRIMARY ($PRIMARY_HOST):"
    if check_ssh "$PRIMARY_HOST" "$PRIMARY_USER" 2>/dev/null; then
        ssh "$PRIMARY_USER@$PRIMARY_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'Docker not running'"
        echo ""
        ssh "$PRIMARY_USER@$PRIMARY_HOST" "free -h | head -2"
    fi
    
    echo ""
    log_info "WORKER ($WORKER_HOST):"
    if check_ssh "$WORKER_HOST" "$WORKER_USER" 2>/dev/null; then
        ssh "$WORKER_USER@$WORKER_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'Docker not running'"
        echo ""
        ssh "$WORKER_USER@$WORKER_HOST" "free -h | head -2"
    fi
    
    echo ""
    log_info "=== Service Endpoints ==="
    echo "Frontend:   https://$PRIMARY_HOST:3000"
    echo "Backend:    http://$PRIMARY_HOST:8000"
    echo "Admin:      http://$PRIMARY_HOST:3100"
    echo "CePO:       http://$WORKER_HOST:8080"
    echo "ChromaDB:   http://$WORKER_HOST:8001"
    echo "Redis:      redis://$WORKER_HOST:6379"
    echo "cAdvisor:   http://$WORKER_HOST:8081"
}

# Stop all services
stop_all() {
    log_info "Stopping all services..."
    
    if check_ssh "$PRIMARY_HOST" "$PRIMARY_USER" 2>/dev/null; then
        log_info "Stopping primary..."
        ssh "$PRIMARY_USER@$PRIMARY_HOST" "cd ~/gogga-deploy && docker compose -f docker-compose.primary.yml down" 2>/dev/null || true
    fi
    
    if check_ssh "$WORKER_HOST" "$WORKER_USER" 2>/dev/null; then
        log_info "Stopping worker..."
        ssh "$WORKER_USER@$WORKER_HOST" "cd ~/gogga-deploy && docker compose -f docker-compose.worker.yml down" 2>/dev/null || true
    fi
    
    log_success "All services stopped"
}

# Run benchmark
run_benchmark() {
    log_info "Running document processing benchmark..."
    cd "$SCRIPT_DIR"
    python3 bench_doc.py --backend "http://$PRIMARY_HOST:8000" --iterations 10 --verbose
}

# Main
case "${1:-status}" in
    all)
        deploy_worker  # Deploy worker first (has CePO, ChromaDB)
        deploy_primary
        show_status
        ;;
    primary)
        deploy_primary
        ;;
    worker)
        deploy_worker
        ;;
    status)
        show_status
        ;;
    stop)
        stop_all
        ;;
    optimize)
        optimize_node "$PRIMARY_HOST" "$PRIMARY_USER"
        optimize_node "$WORKER_HOST" "$WORKER_USER"
        ;;
    benchmark)
        run_benchmark
        ;;
    *)
        echo "GOGGA Distributed Deployment"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  all       - Deploy to all nodes"
        echo "  primary   - Deploy to primary node only (192.168.0.130)"
        echo "  worker    - Deploy to worker node only (192.168.0.198)"
        echo "  status    - Show status of all nodes"
        echo "  stop      - Stop all services"
        echo "  optimize  - Run NVMe optimization on all nodes"
        echo "  benchmark - Run document processing benchmark"
        echo ""
        echo "Environment variables:"
        echo "  GOGGA_PRIMARY_USER - SSH user for primary (default: ubuntu)"
        echo "  GOGGA_WORKER_USER  - SSH user for worker (default: ubuntu)"
        ;;
esac
