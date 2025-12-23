#!/bin/bash
# Gogga Distributed Infrastructure Health Check
# Run from any machine on the 192.168.0.x network

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRIMARY_IP="192.168.0.130"
WORKER_IP="192.168.0.198"
TIMEOUT=5

# Counters
PASSED=0
FAILED=0
TOTAL=7

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       GOGGA DISTRIBUTED INFRASTRUCTURE HEALTH CHECK        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Primary Node:${NC} $PRIMARY_IP"
echo -e "${YELLOW}Worker Node:${NC}  $WORKER_IP"
echo ""

# Function to check HTTP/HTTPS service
check_http() {
    local name="$1"
    local url="$2"
    local node="$3"
    local insecure="$4"
    
    printf "%-12s %-40s %-12s " "$name" "$url" "$node"
    
    if [ "$insecure" = "true" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -m $TIMEOUT -k "$url" 2>/dev/null) || response="000"
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -m $TIMEOUT "$url" 2>/dev/null) || response="000"
    fi
    
    if [ "$response" = "200" ] || [ "$response" = "307" ]; then
        echo -e "${GREEN}✓ UP (HTTP $response)${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ DOWN (HTTP $response)${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to check TCP service (Redis)
check_tcp() {
    local name="$1"
    local host="$2"
    local port="$3"
    local node="$4"
    
    printf "%-12s %-40s %-12s " "$name" "$host:$port" "$node"
    
    if timeout $TIMEOUT bash -c "echo PING | nc -q1 $host $port 2>/dev/null | grep -q PONG"; then
        echo -e "${GREEN}✓ UP (PONG)${NC}"
        ((PASSED++))
        return 0
    elif timeout $TIMEOUT bash -c ">/dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ UP (TCP OK)${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ DOWN${NC}"
        ((FAILED++))
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
printf "%-12s %-40s %-12s %s\n" "SERVICE" "URL" "NODE" "STATUS"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# MAC-1 Primary Services
check_http "Frontend" "https://$PRIMARY_IP:3002" "MAC-1" "true"
check_http "Backend" "https://$PRIMARY_IP:8000/health" "MAC-1" "true"
check_http "Admin" "http://$PRIMARY_IP:3100" "MAC-1" "false"

# MAC-2 Worker Services
check_http "CePO" "http://$WORKER_IP:8080/v1/models" "MAC-2" "false"
check_http "ChromaDB" "http://$WORKER_IP:8001/api/v2/heartbeat" "MAC-2" "false"
check_tcp "Redis" "$WORKER_IP" "6379" "MAC-2"
check_http "cAdvisor" "http://$WORKER_IP:8081/containers/" "MAC-2" "false"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Summary
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All $TOTAL services are healthy!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ $FAILED/$TOTAL services are down${NC}"
    echo -e "${GREEN}✓ $PASSED/$TOTAL services are up${NC}"
    echo ""
    exit 1
fi
