#!/bin/bash

echo "=== GOGGA AUTO-FIX SCRIPT ==="
echo "Sit back, you beautiful disaster."

ROOT=~/Dev-Projects/Gogga

# -------------------------------
# Fix backend Dockerfile (Python)
# -------------------------------
BACKEND_DIR="$ROOT/gogga-backend"
if [ -d "$BACKEND_DIR" ]; then
    echo "[+] Fixing backend Dockerfile..."

    cat > "$BACKEND_DIR/Dockerfile" << 'EOF'
# ============================
# Stage 1: Builder
# ============================
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ============================
# Stage 2: Runtime
# ============================
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

EXPOSE 4000

CMD ["python", "main.py"]
EOF

else
    echo "[!] No backend folder found — skipping Python backend."
fi


# -------------------------------
# Fix frontend Dockerfile (Node)
# -------------------------------
FRONTEND_DIR="$ROOT/gogga-frontend"
if [ -d "$FRONTEND_DIR" ]; then
    echo "[+] Fixing frontend Dockerfile..."

    cat > "$FRONTEND_DIR/Dockerfile" << 'EOF'
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
EOF

else
    echo "[!] No frontend folder found — skipping Node frontend."
fi


# -------------------------------
# Create docker-compose.override.yml
# -------------------------------
echo "[+] Writing docker-compose.override.yml..."

cat > "$ROOT/docker-compose.override.yml" << 'EOF'
version: "3.9"

services:
  gogga-frontend:
    build:
      context: ./gogga-frontend
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
    ports:
      - "3000:3000"
    volumes:
      - ./gogga-frontend:/app
    restart: unless-stopped

  gogga-backend:
    build:
      context: ./gogga-backend
    command: ["python", "main.py"]
    ports:
      - "4000:4000"
    volumes:
      - ./gogga-backend:/app
    restart: unless-stopped
EOF


# -------------------------------
# All done
# -------------------------------
echo "=== DONE ==="
echo "Your Docker environment is fixed."
echo "Run with:"
echo "   docker compose up --build -d"
echo "ZeroTier IP will expose:"
echo "   http://<your-zt-ip>:3000"
echo "   http://<your-zt-ip>:4000"
