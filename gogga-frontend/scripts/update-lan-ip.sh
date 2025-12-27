#!/bin/bash
# Script to update .env.local with current LAN IP
# Run this before starting the dev server if your IP changes
#
# MODES:
#   LOCAL DEV (pnpm dev):   Port 3000 - this script updates .env.local
#   DOCKER (docker compose): Port 3002 - manually set in .env.local
#
# If using Docker, don't run this script - it will override to port 3000

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$FRONTEND_DIR/.env.local"
PACKAGE_JSON="$FRONTEND_DIR/package.json"

# Get the current LAN IP (prefer wlan, fallback to eth)
get_lan_ip() {
    # Try wireless first (wlp3s0, wlan0)
    ip -4 addr show 2>/dev/null | grep -E "inet.*wl" | head -1 | awk '{print $2}' | cut -d/ -f1
}

LAN_IP=$(get_lan_ip)

if [ -z "$LAN_IP" ]; then
    # Fallback: get first non-localhost, non-docker IP
    LAN_IP=$(ip -4 addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | grep -v "172.1" | grep -v "10.0.0" | head -1 | awk '{print $2}' | cut -d/ -f1)
fi

if [ -z "$LAN_IP" ]; then
    echo "ERROR: Could not determine LAN IP address"
    exit 1
fi

echo "Detected LAN IP: $LAN_IP"

# Local dev port (distinct from Docker port 3002)
LOCAL_PORT=3000

# Update .env.local (only if IP changed to avoid triggering watchers)
if [ -f "$ENV_FILE" ]; then
    CURRENT_ENV_IP=$(grep -oE 'NEXT_PUBLIC_BASE_URL=https://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' "$ENV_FILE" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if [ "$CURRENT_ENV_IP" != "$LAN_IP" ]; then
        # Replace IP and PORT in NEXT_PUBLIC_BASE_URL and NEXTAUTH_URL
        # This ensures local dev (port 3000) works correctly with NextAuth
        sed -i -E "s|NEXT_PUBLIC_BASE_URL=https://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+|NEXT_PUBLIC_BASE_URL=https://${LAN_IP}:${LOCAL_PORT}|g" "$ENV_FILE"
        sed -i -E "s|NEXTAUTH_URL=https://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+|NEXTAUTH_URL=https://${LAN_IP}:${LOCAL_PORT}|g" "$ENV_FILE"
        echo "Updated .env.local with IP: $LAN_IP, port: $LOCAL_PORT"
    else
        echo ".env.local already has correct IP: $LAN_IP"
    fi
else
    echo "WARNING: $ENV_FILE not found"
fi

# Update package.json dev script (only if IP changed to avoid triggering watchers)
if [ -f "$PACKAGE_JSON" ]; then
    CURRENT_IP=$(grep -oE 'next dev -H [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' "$PACKAGE_JSON" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if [ "$CURRENT_IP" != "$LAN_IP" ]; then
        sed -i -E "s|next dev -H [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|next dev -H ${LAN_IP}|g" "$PACKAGE_JSON"
        echo "Updated package.json dev script with IP: $LAN_IP"
    else
        echo "package.json already has correct IP: $LAN_IP"
    fi
else
    echo "WARNING: $PACKAGE_JSON not found"
fi

echo "Done! LAN IP updated to: $LAN_IP"
echo "Start dev server with: pnpm dev"
