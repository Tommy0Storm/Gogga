# Docker Best Practices for Node.js Development (Dec 2025)

## 🚨 NB! CRITICAL: DOCKER FRONTEND TURBOPACK CONFIGURATION (Dec 2025)

**THIS CONFIGURATION WORKS. DO NOT CHANGE WITHOUT UNDERSTANDING WHY.**

### The Problems That Were Fixed
1. `ERR_INCOMPLETE_CHUNKED_ENCODING` errors (frontend container dying mid-response)
2. `Failed to persist usage to database` errors (backend→frontend connectivity)
3. Container showing "Server is approaching the used memory threshold, restarting..."

### The Working Configuration

#### 1. Frontend Memory & Heap Settings (docker-compose.override.yml)
```yaml
frontend:
  deploy:
    resources:
      limits:
        memory: 4G  # ❌ NOT 3G - causes OOM during compilation
  environment:
    NODE_OPTIONS: --max-old-space-size=3584  # 90% of 4G container limit
```

#### 2. USE TURBOPACK (NOT WEBPACK!)
```yaml
# docker-compose.override.yml - frontend command
command: sh -c "npm install && ./node_modules/.bin/prisma generate && ./node_modules/.bin/next dev -H 0.0.0.0 -p 3000 --experimental-https..."

# ❌ DO NOT ADD --webpack FLAG!
# Turbopack is the default in Next.js 16 and uses SIGNIFICANTLY LESS MEMORY
# Webpack was causing the memory exhaustion and ERR_INCOMPLETE_CHUNKED_ENCODING
```

#### 3. Turbopack Filesystem Cache (next.config.js) - CRITICAL!
```javascript
// gogga-frontend/next.config.js
experimental: {
  optimizePackageImports: ['react-icons', 'lucide-react'],
  turbopackFileSystemCacheForDev: true,  // ⚡ CRITICAL: Reduces memory, faster restarts
}
```

#### 4. Backend → Frontend Connectivity (docker-compose.override.yml)
```yaml
backend:
  environment:
    FRONTEND_URL: https://frontend:3000  # Docker network name, NOT localhost!
```

#### 5. SSL Context for Self-Signed Certs (cost_tracker.py)
```python
# gogga-backend/app/services/cost_tracker.py
import ssl
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE

# Use in ALL httpx.AsyncClient calls:
async with httpx.AsyncClient(timeout=5.0, verify=_ssl_context) as client:
```

### Why This Works
| Setting | Purpose |
|---------|---------|
| **Turbopack** | Incremental compilation = lower peak memory than webpack |
| **turbopackFileSystemCacheForDev** | Persists compiled modules across restarts (game-changer!) |
| **4G memory limit** | Gives headroom for initial compilation spike |
| **3584MB heap** | 90% of container limit, prevents Node from exceeding container RAM |
| **Docker network name** | `frontend` resolves correctly inside containers (localhost doesn't) |
| **SSL context** | Trusts self-signed certs for inter-container HTTPS |

### Healthy State Metrics (What Good Looks Like)
```
gogga_ui:  ~3GB / 4GB (75%) - STABLE after initial compile
gogga_api: ~50MB / 512MB (10%) - STABLE
```

### Files That Were Modified
| File | Change |
|------|--------|
| `/docker-compose.override.yml` | Memory 4G, heap 3584MB, FRONTEND_URL, removed --webpack |
| `/gogga-frontend/next.config.js` | `turbopackFileSystemCacheForDev: true` |
| `/gogga-backend/app/services/cost_tracker.py` | SSL context for httpx calls |

---

## ⚠️ CRITICAL: HTTPS Backend Proxy with Self-Signed Certs

The backend runs HTTPS with self-signed certificates. **Next.js rewrites DO NOT work** with self-signed certs even with `NODE_TLS_REJECT_UNAUTHORIZED=0`.

### Solution: Use API Routes with Custom HTTPS Agent

```typescript
// src/app/api/v1/tools/route.ts
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Accept self-signed certs
});

// Use native Node.js https module, NOT fetch()
const response = await new Promise((resolve, reject) => {
  const url = new URL(backendUrl);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'GET',
    agent: url.protocol === 'https:' ? httpsAgent : undefined,
  };
  const req = https.request(options, (res) => { /* ... */ });
  req.end();
});
```

### Current Proxy Configuration

| Endpoint | Handler | Notes |
|----------|---------|-------|
| `/api/v1/tools` | API route (`src/app/api/v1/tools/route.ts`) | Custom https.Agent |
| `/api/v1/tools/execute` | API route (`src/app/api/v1/tools/execute/route.ts`) | Custom https.Agent |
| `/api/v1/images/*` | next.config.js rewrite | Uses HTTP internally |
| `/api/v1/payments/*` | next.config.js rewrite | Uses HTTP internally |
| `/health` | next.config.js rewrite | Uses HTTP internally |

### Environment Variables

```yaml
# docker-compose.yml frontend environment
BACKEND_URL: https://backend:8000  # HTTPS for secure communication
NODE_TLS_REJECT_UNAUTHORIZED: "0"  # Accept self-signed (belt-and-suspenders)
```

## ⚠️ CRITICAL: node_modules Volume Anti-Pattern

**NEVER mount `node_modules` as a bind mount or volume for Node.js containers!**

### Why node_modules volumes break:
1. **Native modules** (better-sqlite3, sharp, esbuild) compile platform-specific binaries
2. Host OS (Ubuntu x64) builds different binaries than container (Alpine musl)
3. Volume mount overwrites container's correctly-built native modules
4. Results in "Could not locate the bindings file" errors

### The Correct Pattern:

```yaml
# ❌ WRONG - causes native module issues
volumes:
  - ./app:/app
  - node_modules:/app/node_modules  # BAD!

# ✅ CORRECT - use Docker Compose watch
volumes:
  - ./app/certs:/app/certs:ro  # Only mount what's needed
develop:
  watch:
    - action: sync
      path: ./app/src
      target: /app/src
      ignore:
        - node_modules/
    - action: rebuild
      path: ./app/package.json
```

## Docker Compose Watch (Recommended for Dev)

Replace bind mounts with `develop.watch` for hot reload:

```yaml
services:
  frontend:
    build:
      context: ./gogga-frontend
      dockerfile: Dockerfile.dev
    develop:
      watch:
        # Sync source files (triggers hot reload)
        - action: sync
          path: ./gogga-frontend/src
          target: /app/src
          ignore:
            - "**/*.test.*"
            - node_modules/
        # Rebuild on package.json change
        - action: rebuild
          path: ./gogga-frontend/package.json
        # Sync config files with restart
        - action: sync+restart
          path: ./gogga-frontend/next.config.js
          target: /app/next.config.js
```

Run with: `docker compose up --watch frontend`

## Development Dockerfile Pattern

```dockerfile
# Use full node image (not minimal/distroless) for dev
FROM node:20-alpine

WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++ gcc libc-dev

# Copy package files first (layer caching)
COPY package.json package-lock.json* ./

# Install dependencies INSIDE container
RUN npm install

# Copy prisma and generate
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY . .

# Dev server
CMD ["npm", "run", "dev"]
```

## GOGGA-Specific Configuration

### Frontend (gogga-frontend)
- **Dockerfile.dev**: `node:20-alpine` with build tools
- **No node_modules volume**: Builds inside container
- **Watch mode**: `docker compose up --watch frontend`
- **Local dev preferred**: `pnpm dev:http` (faster iteration)

### Admin (gogga-admin)
- **Dockerfile.dev**: `node:20-alpine` with build tools
- **Native module rebuild**: CMD rebuilds `better-sqlite3` on startup
- **Volume for node_modules**: Required because of bind mount pattern
- **Rebuild command**: Runs `npm run build-release` for native modules

### Backend (gogga-backend)
- **Python**: No native module issues
- **Standard bind mount**: Works fine for Python

## Commands

```bash
# Start with watch mode (hot reload)
docker compose up --watch frontend

# Force rebuild (after Dockerfile changes)
docker compose build --no-cache frontend && docker compose up -d frontend

# Start local dev (faster, recommended)
cd gogga-frontend && pnpm dev:http

# Remove stale volumes
docker volume rm gogga_frontend_node_modules gogga_admin_node_modules

# Full cleanup and rebuild
docker compose down -v && docker compose up -d --build
```

## 🔧 Frontend Container Rebuild Procedure (Dec 2025)

When you need to rebuild the frontend container (e.g., after Dockerfile changes, package.json changes, or config changes):

```bash
# Full rebuild with cache clear
cd /home/ubuntu/Dev-Projects/Gogga
docker compose down frontend
docker compose build --no-cache frontend
docker compose up -d frontend

# Verify the container started correctly
docker compose logs --tail 30 frontend
```

### Key Points:
1. **pnpm version pinned**: Use `pnpm@10.12.1` in Dockerfile.dev (not `pnpm@latest` - causes npm registry timeouts)
2. **Turbopack filesystem cache**: Disabled in Docker via `DOCKER_ENV=true` environment variable
3. **No .next volume mount**: Container uses ephemeral .next to prevent cache corruption
4. **Source bind mount**: `./gogga-frontend:/app` syncs file changes automatically

### Checking for successful rebuild:
- Look for `⨯ turbopackFileSystemCacheForDev` (crossed out = disabled, which is correct for Docker)
- Verify `✓ Ready in xxxms` appears in logs
- First compilation takes ~60-120s (cold cache), subsequent requests ~200-900ms

## ⚠️ Turbopack Cache Corruption in Docker (Fixed Dec 2025)

**Problem**: Turbopack's persistent filesystem cache (`turbopackFileSystemCacheForDev: true`) corrupts when container restarts, causing:
- `Failed to restore task data from cache`  
- `Failed to load chunk /_next/static/chunks/...`
- `Eish! Something went wrong` errors

**Solution**: Disable Turbopack filesystem cache in Docker:

### 1. next.config.js
```javascript
experimental: {
  optimizePackageImports: ['react-icons', 'lucide-react'],
  // Disable Turbopack filesystem cache in Docker (causes corruption on restart)
  turbopackFileSystemCacheForDev: process.env.DOCKER_ENV !== 'true',
}
```

### 2. docker-compose.yml
```yaml
frontend:
  environment:
    DOCKER_ENV: "true"  # Triggers cache disable in next.config.js
  volumes:
    - ./gogga-frontend:/app
    - ./gogga-frontend/prisma:/app/prisma
    - ./gogga-frontend/certs:/app/certs:ro
    - frontend_node_modules:/app/node_modules
    # NO .next volume - prevents cache persistence/corruption
```

### 3. Dockerfile.dev pnpm version
```dockerfile
# Use specific version - @latest causes npm registry timeout
RUN apk update && apk add --no-cache python3 make g++ wget && \
    corepack enable && corepack prepare pnpm@10.12.1 --activate
```

### Result:
- Container restarts cleanly with fresh Turbopack cache
- Each startup does cold compilation (~60-120s) but no corruption
- Browser requires hard refresh (`Ctrl+Shift+R`) after container restart to clear stale chunk cache

## When Docker Dev Fails, Use Local Dev

For fastest iteration, prefer local development:

```bash
# Frontend (local, not Docker)
cd gogga-frontend && pnpm dev:http

# Backend (Docker is fine)
docker compose up -d backend

# Admin (Docker is fine after native module fix)
docker compose up -d admin
```
