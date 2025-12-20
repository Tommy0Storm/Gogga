#!/bin/bash
# =============================================================================
# GOGGA Distributed Setup - Step 4: Docker Context Configuration
# =============================================================================
# Sets up Docker contexts for controlling both servers from primary
# Allows seamless switching between primary and worker Docker daemons
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
DOCKER_PORT="2376"
PRIMARY_CONTEXT="gogga-primary"
WORKER_CONTEXT="gogga-worker"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  GOGGA Distributed - Docker Context Setup${NC}"
echo -e "${BLUE}============================================${NC}"

# =============================================================================
# CREATE DOCKER CONTEXTS
# =============================================================================
echo -e "\n${YELLOW}[1/4]${NC} Creating Docker context for primary server..."

# Remove existing context if present
docker context rm "$PRIMARY_CONTEXT" 2>/dev/null || true

# Create primary context (local socket)
docker context create "$PRIMARY_CONTEXT" \
    --description "GOGGA Primary Server (192.168.0.130) - Frontend, Backend, Admin" \
    --docker "host=unix:///var/run/docker.sock"

echo -e "${GREEN}✓${NC} Primary context created"

echo -e "\n${YELLOW}[2/4]${NC} Creating Docker context for worker server..."

# Remove existing context if present
docker context rm "$WORKER_CONTEXT" 2>/dev/null || true

# Create worker context (TCP remote)
docker context create "$WORKER_CONTEXT" \
    --description "GOGGA Worker Server (192.168.0.198) - CePO, AI workloads, DEV-Drive" \
    --docker "host=tcp://${WORKER_IP}:${DOCKER_PORT}"

echo -e "${GREEN}✓${NC} Worker context created"

# =============================================================================
# CREATE HELPER SCRIPTS
# =============================================================================
echo -e "\n${YELLOW}[3/4]${NC} Creating helper scripts..."

# Create docker-primary alias script
cat > ~/bin/docker-primary << 'EOF'
#!/bin/bash
# Run Docker commands on primary server (192.168.0.130)
docker --context gogga-primary "$@"
EOF
chmod +x ~/bin/docker-primary

# Create docker-worker alias script
cat > ~/bin/docker-worker << 'EOF'
#!/bin/bash
# Run Docker commands on worker server (192.168.0.198)
docker --context gogga-worker "$@"
EOF
chmod +x ~/bin/docker-worker

# Create context switching script
cat > ~/bin/docker-switch << 'EOF'
#!/bin/bash
# Switch Docker context between primary and worker
CURRENT=$(docker context show)
if [[ "$CURRENT" == "gogga-primary" ]] || [[ "$CURRENT" == "default" ]]; then
    docker context use gogga-worker
    echo "Switched to WORKER (192.168.0.198)"
else
    docker context use gogga-primary
    echo "Switched to PRIMARY (192.168.0.130)"
fi
EOF
chmod +x ~/bin/docker-switch

echo -e "${GREEN}✓${NC} Helper scripts created in ~/bin/"

# Add ~/bin to PATH if not already present
if ! grep -q 'export PATH="$HOME/bin:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
    echo -e "${GREEN}✓${NC} Added ~/bin to PATH in .bashrc"
fi

# =============================================================================
# CREATE COMPOSE HELPER ALIASES
# =============================================================================
echo -e "\n${YELLOW}[4/4]${NC} Creating shell aliases..."

# Add aliases to bashrc if not present
if ! grep -q "# GOGGA Docker Distributed Aliases" ~/.bashrc; then
    cat >> ~/.bashrc << 'EOF'

# GOGGA Docker Distributed Aliases
alias dp='docker --context gogga-primary'       # Docker on primary
alias dw='docker --context gogga-worker'        # Docker on worker
alias dcw='docker compose --context gogga-worker'  # Docker compose on worker
alias dcp='docker compose --context gogga-primary' # Docker compose on primary
alias dctx='docker context show'                # Show current context
alias dctxs='docker context ls'                 # List all contexts
EOF
    echo -e "${GREEN}✓${NC} Added Docker aliases to .bashrc"
else
    echo -e "${GREEN}✓${NC} Docker aliases already in .bashrc"
fi

# List contexts
echo -e "\n${YELLOW}Available Docker contexts:${NC}"
docker context ls

# Test both contexts
echo -e "\n${YELLOW}Testing contexts...${NC}"
echo -e "\n${BLUE}Primary context:${NC}"
docker --context "$PRIMARY_CONTEXT" info --format '{{.Name}}' 2>/dev/null && echo "✓ Primary OK" || echo "✗ Primary failed"

echo -e "\n${BLUE}Worker context:${NC}"
docker --context "$WORKER_CONTEXT" info --format '{{.Name}}' 2>/dev/null && echo "✓ Worker OK" || echo "✗ Worker failed (may need Docker restart)"

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}  Docker Context Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e ""
echo -e "Usage:"
echo -e "  ${BLUE}docker --context gogga-worker ps${NC}     - Run on worker"
echo -e "  ${BLUE}docker --context gogga-primary ps${NC}    - Run on primary"
echo -e "  ${BLUE}dw ps${NC}                                - Alias for worker"
echo -e "  ${BLUE}dp ps${NC}                                - Alias for primary"
echo -e "  ${BLUE}docker-switch${NC}                        - Toggle default context"
echo -e ""
echo -e "Run ${BLUE}source ~/.bashrc${NC} to activate aliases in current shell"
