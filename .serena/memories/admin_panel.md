# GOGGA Admin Panel

## Overview
Separate Docker container (`gogga-admin`) providing full administrative control over the GOGGA platform.
Runs on port **3100** (separate from frontend :3000 and backend :8000).

## Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      GOGGA Admin Panel                          │
│                   (Next.js 16 on port 3100)                     │
├─────────────────────────────────────────────────────────────────┤
│  Connects to:                                                    │
│  ├── Backend API (localhost:8000) - Service control             │
│  ├── Frontend DB (shared SQLite) - User/Subscription data       │
│  ├── CePO Sidecar (localhost:8080) - Reasoning service          │
│  └── Docker API (socket) - Container management                 │
└─────────────────────────────────────────────────────────────────┘
```

## Folder Structure
```
gogga-admin/
├── Dockerfile
├── Dockerfile.dev
├── tools/
│   ├── sqlite3
│   ├── sqlite3_analyzer
│   ├── sqldiff
│   └── sqlite3_rsync
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
├── .env.local
├── prisma/
│   └── schema.prisma (shared with frontend)
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx (dashboard)
    │   ├── api/
    │   │   ├── services/route.ts
    │   │   ├── users/route.ts
    │   │   ├── subscriptions/route.ts
    │   │   ├── vouchers/route.ts
    │   │   └── logs/route.ts
    │   └── (tabs)/
    │       ├── services/page.tsx
    │       ├── users/page.tsx
    │       ├── subscriptions/page.tsx
    │       ├── vouchers/page.tsx
    │       ├── logs/page.tsx
    │       ├── database/page.tsx
    │       └── settings/page.tsx
    ├── components/
    │   ├── AdminLayout.tsx
    │   ├── ServiceCard.tsx
    │   ├── ServiceStatus.tsx
    │   ├── SubscriptionAdmin.tsx
    │   ├── VoucherManager.tsx
    │   ├── UserLookup.tsx
    │   ├── LogsViewer.tsx
    │   ├── DatabaseStatus.tsx
    │   └── SystemSettings.tsx
    └── lib/
        ├── prisma.ts
        ├── docker.ts
        └── services.ts
```

## Features by Tab

### 1. Services (Abstract Service Management)
Monitors **logical services**, not Docker containers:

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 8000 | FastAPI server for AI/payments |
| CePO Sidecar | 8080 | OptiLLM chain-of-thought proxy |
| APScheduler | Internal | Background job scheduler |
| Frontend App | 3000 | Next.js web UI |

**Features:**
- Real-time health status (online/offline)
- Start/Stop/Restart controls (shell execution)
- Latency monitoring with Recharts area graph
- Log viewer modal (tail -n 100)
- 15-second auto-refresh

**API Routes:**
- `GET /api/services` - List all services with status
- `POST /api/services/[service]/[action]` - start/stop/restart
- `GET /api/services/[service]/logs` - Tail log file

### 1b. Live Terminal
Full xterm.js-based terminal view with real-time log streaming.

**Features:**
- Single/Split/Quad view modes
- Real-time log streaming (2-second polling)
- Pause/Resume/Clear controls
- Fullscreen mode
- Green-on-black terminal aesthetic

**Components:**
- `/terminal` page with multi-terminal layout
- `LiveTerminal.tsx` component using @xterm/xterm
- `GET /api/terminal/[service]/stream` - Log streaming API

### 2. External APIs (Monitor Only)
| API | Check Method |
|-----|--------------|
| Cerebras | GET health check |
| OpenRouter | GET health check |
| DeepInfra | GET health check |
| PayFast | Ping sandbox/production |
| EmailJS | Config validation |

### 3. Database (Enhanced)

Full SQLite database management with 6 tabs:

| Tab | Description |
|-----|-------------|
| Overview | Database size, table counts, vacuum button |
| SQL Query | Execute raw SQL queries (read-only safety mode) |
| Browse | View/search/paginate/delete rows in any table |
| Schema | View columns, types, indexes for each table |
| Tools | Run SQLite integrity check, analyzer, PRAGMA stats |
| Backup | Create/list database backups |

**API Endpoints:**
- `GET /api/database` - Database overview and table counts
- `POST /api/database/query` - Execute SQL queries
- `GET /api/database/schema` - Get full schema info
- `GET /api/database/browse` - Browse table data with pagination
- `PUT /api/database/browse` - Update rows
- `DELETE /api/database/browse` - Delete rows
- `GET /api/database/backup` - List backups
- `POST /api/database/backup` - Create backup
- `GET /api/database/tools` - Run SQLite tools (integrity, analyzer, stats)
- `POST /api/database/vacuum` - Run VACUUM on database

**SQLite Tools (in `gogga-admin/tools/`):**
- `sqlite3` - Command-line shell (v3.51.0)
- `sqlite3_analyzer` - Database statistics analyzer
- `sqldiff` - Database diff tool
- `sqlite3_rsync` - Sync tool

### 4. Subscriptions
- Search user by email
- Override tier
- Grant credits
- Force cancel (PayFast + DB)
- Reset monthly credits
- View subscription history

### 5. Vouchers
Types:
- JIGGA_1MONTH: Free month of JIGGA
- R500: Credit pack voucher

Tabs:
- Create (single/bulk up to 100)
- Active (filter: redeemed, voided, expired)
- Redeemed (redeemedBy, redeemedAt)
- Search (by code, by user)

Actions:
- Void voucher
- Hard delete (if not redeemed)
- Export CSV

### 6. Logs & Audit
Sources:
- AuthLog (token_requested, login_success, login_failed)
- VoucherLog (created, redeemed, voided)
- Subscription events
- PayFast ITN events
- CePO error logs

Filters:
- Date range
- Action type
- User email

### 7. User Lookup
Search by email shows:
- Account info
- Subscription details
- Credits remaining
- Image quota
- Redeemed vouchers
- PayFast history
- Auth history (last 10)

Admin Actions:
- Force passwordless login email
- Force subscription upgrade/downgrade
- Apply voucher to user
- Toggle isAdmin flag

### 8. System Settings (Read Only)
- Running mode: sandbox/production
- Environment variables (redacted)
- Service versions
- Build info (git commit, last deploy)
- Uptime per service

## Database Schema Additions

```prisma
// Add to existing schema

model Voucher {
  id          String    @id @default(cuid())
  code        String    @unique
  type        String    // JIGGA_1MONTH, R500
  createdBy   String    // Admin email
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  voided      Boolean   @default(false)
  voidedAt    DateTime?
  voidedBy    String?
  redeemed    Boolean   @default(false)
  redeemedAt  DateTime?
  redeemedBy  String?   // User email
  userId      String?   // User who redeemed
}

model VoucherLog {
  id        String   @id @default(cuid())
  voucherId String
  action    String   // created, redeemed, voided, deleted
  actor     String   // Admin or user email
  meta      String?  // JSON metadata
  createdAt DateTime @default(now())
}

model AdminLog {
  id        String   @id @default(cuid())
  adminEmail String
  action    String   // subscription_override, voucher_create, etc.
  targetUser String?
  meta      String?  // JSON metadata
  createdAt DateTime @default(now())
}
```

## Docker Configuration
```yaml
# docker-compose.yml addition
gogga-admin:
  build:
    context: ./gogga-admin
    dockerfile: Dockerfile
  container_name: gogga-admin
  ports:
    - "3100:3100"
  environment:
    - DATABASE_URL=file:../gogga-frontend/prisma/dev.db
    - BACKEND_URL=http://gogga-backend:8000
    - CEPO_URL=http://gogga-cepo:8080
    - INTERNAL_API_KEY=${INTERNAL_API_KEY}
    - ADMIN_EMAILS=admin@vcb-ai.online
  volumes:
    - ./gogga-frontend/prisma:/app/prisma:ro
    - /var/run/docker.sock:/var/run/docker.sock
  depends_on:
    - gogga-backend
    - gogga-frontend
  networks:
    - gogga-network
```

## Security
- Admin-only access via `isAdmin` flag in User model
- **Service Admin role** via `isServiceAdmin` flag - can start/stop/restart services
- ADMIN_EMAILS env var for initial admin setup
- All actions logged to AdminLog
- Service actions require `isServiceAdmin` OR `isAdmin` privileges

### Service Admin Management
- API: `GET/POST /api/users/service-admin`
- UI: "Service Admins" button in Services page header
- Grant/revoke service admin access by email
- All service actions (start/stop/restart) logged to AdminLog with actor email

## Implementation Status
- [x] Create gogga-admin folder structure
- [x] Set up Next.js 16 project (package.json, tsconfig, configs)
- [x] Create Prisma schema with Voucher models
- [x] Create globals.css with monochrome theme
- [x] Create AdminLayout component (sidebar navigation)
- [x] Create Dashboard page with metrics
- [x] Create Services page (start/stop/restart)
- [x] Create Users page (lookup with full info)
- [x] Create Subscriptions page (management)
- [x] Create Vouchers page (create/void/search tabs)
- [x] Create Logs page (auth, admin, voucher, subscription)
- [x] Create Database page (6 tabs: Overview, SQL Query, Browse, Schema, Tools, Backup)
- [x] Create Settings page (read-only config)
- [x] Create all API routes
- [x] Add to docker-compose.yml
- [x] Add admin models to frontend Prisma schema

## Status: ✅ Complete

All 8 sections implemented and working:
- Dashboard with real-time metrics and health checks
- Services management (start/stop/restart controls)
- External API monitoring (Cerebras, OpenRouter, DeepInfra, PayFast)
- User lookup with full account details
- Subscription management with tier override
- Voucher CRUD with create/void/search tabs
- Logs viewer with multi-type filtering
- Database stats with vacuum support
- Settings with read-only config display

**Verified Working:**
- HTTP 200 on main page
- /api/stats returns user/subscription/voucher counts
- /api/database returns SQLite stats and table counts
- Database connection with absolute path

## Remaining for Production
- [ ] Add proper admin authentication middleware
- [ ] Docker container communication testing
- [ ] PayFast webhook integration for real-time sync