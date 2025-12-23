#!/bin/bash
# ================================================
# GOGGA Xneelo VPS Deployment Script
# Run this on your fresh Xneelo Cloud 2 VPS
# ================================================

set -e  # Exit on error

echo "🚀 GOGGA Xneelo Deployment Starting..."

# ================================================
# CONFIGURATION (EDIT THESE!)
# ================================================
DOMAIN="staging.gogga.co.za"
API_DOMAIN="api-staging.gogga.co.za"
TURSO_DB_URL="libsql://gogga-staging-your-org.turso.io"
TURSO_AUTH_TOKEN="eyJhbGc..."  # Get from: turso db tokens create gogga-staging
CEREBRAS_API_KEY="sk-..."
OPENROUTER_API_KEY="sk-or-..."
PAYFAST_MERCHANT_ID="10000100"
PAYFAST_MERCHANT_KEY="46f0cd694581a"
PAYFAST_PASSPHRASE="jt7NOE43FZPn"

# ================================================
# STEP 1: System Setup
# ================================================
echo "📦 Installing system packages..."
sudo apt update
sudo apt install -y \
    git \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw

# ================================================
# STEP 2: Docker Installation
# ================================================
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  You'll need to log out and back in for Docker permissions"
fi

# ================================================
# STEP 3: Add Swap (2GB RAM is tight!)
# ================================================
echo "💾 Adding 2GB swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
fi

# ================================================
# STEP 4: Firewall Configuration
# ================================================
echo "🔒 Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# ================================================
# STEP 5: Clone GOGGA Repository
# ================================================
echo "📥 Cloning GOGGA repository..."
cd /home/$USER
if [ -d "Gogga" ]; then
    cd Gogga
    git pull origin main
else
    git clone https://github.com/Tommy0Storm/Gogga.git
    cd Gogga
fi

# ================================================
# STEP 6: Create Environment File
# ================================================
echo "⚙️  Creating environment configuration..."
cat > gogga-backend/.env <<EOF
# Database
DATABASE_URL=$TURSO_DB_URL
DATABASE_AUTH_TOKEN=$TURSO_AUTH_TOKEN

# AI APIs
CEREBRAS_API_KEY=$CEREBRAS_API_KEY
OPENROUTER_API_KEY=$OPENROUTER_API_KEY

# PayFast (Sandbox)
PAYFAST_ENV=sandbox
PAYFAST_MERCHANT_ID=$PAYFAST_MERCHANT_ID
PAYFAST_MERCHANT_KEY=$PAYFAST_MERCHANT_KEY
PAYFAST_PASSPHRASE=$PAYFAST_PASSPHRASE

# Server
ALLOWED_ORIGINS=https://$DOMAIN,https://$API_DOMAIN
EOF

# ================================================
# STEP 7: Build Frontend (Static Export)
# ================================================
echo "🎨 Building frontend (this takes ~5 minutes)..."
cd gogga-frontend

# Enable pnpm
corepack enable

# Install dependencies
pnpm install --frozen-lockfile

# Build static export
pnpm build

# Export to static files
pnpm export  # Generates /out folder

# Create web directory
sudo mkdir -p /var/www/gogga
sudo cp -r out/* /var/www/gogga/
sudo chown -R www-data:www-data /var/www/gogga

cd ..

# ================================================
# STEP 8: Start Backend + CePO (Docker)
# ================================================
echo "🔧 Starting backend services..."
cd gogga-backend
docker compose up -d --build

# Wait for backend to start
echo "⏳ Waiting for backend to be ready..."
sleep 10

# Test backend health
curl -f http://localhost:8000/health || echo "⚠️  Backend health check failed"

cd ..

# ================================================
# STEP 9: Install Caddy (Reverse Proxy + HTTPS)
# ================================================
echo "🌐 Installing Caddy web server..."
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# ================================================
# STEP 10: Configure Caddy
# ================================================
echo "📝 Configuring Caddy reverse proxy..."
sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
# Frontend
$DOMAIN {
    root * /var/www/gogga
    file_server
    
    # API routes go to backend
    handle /api/* {
        reverse_proxy localhost:8000
    }
    
    # SPA fallback
    try_files {path} /index.html
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}

# Backend API (optional separate domain)
$API_DOMAIN {
    reverse_proxy localhost:8000
}
EOF

# ================================================
# STEP 11: Start Caddy
# ================================================
echo "🚀 Starting Caddy..."
sudo systemctl restart caddy
sudo systemctl enable caddy

# ================================================
# STEP 12: Display Setup Information
# ================================================
echo ""
echo "============================================"
echo "✅ GOGGA DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "📍 VPS IP Address: $(curl -s ifconfig.me)"
echo ""
echo "🌐 Next Steps:"
echo "1. Point DNS to this IP:"
echo "   - $DOMAIN → $(curl -s ifconfig.me)"
echo "   - $API_DOMAIN → $(curl -s ifconfig.me)"
echo ""
echo "2. Test backend (local):"
echo "   curl http://localhost:8000/health"
echo ""
echo "3. After DNS propagates (5-60 minutes):"
echo "   https://$DOMAIN"
echo ""
echo "📊 Service Status:"
docker ps
echo ""
echo "📝 View Logs:"
echo "   Backend: docker logs gogga_api"
echo "   Caddy:   sudo journalctl -u caddy -f"
echo ""
echo "🔐 Tester Access:"
echo "   URL: https://$DOMAIN"
echo "   (Public - add BasicAuth if needed)"
echo ""
echo "============================================"
