# GOGGA Development Status

## Last Updated: December 6, 2025 (Auth + Subscription System Complete)

---

## 🌐 Development URLs

| Service | Container | URL |
|---------|-----------|-----|
| Frontend | `gogga_ui` | http://192.168.0.168:3001 |
| Backend API | `gogga_api` | http://192.168.0.168:8000 |
| Admin Dashboard | `gogga_admin` | http://192.168.0.168:3100 |
| CePO Sidecar | `gogga_cepo` | http://192.168.0.168:8080 |

**Note**: Frontend uses port 3001 via TCP proxy due to Next.js 16 network access bug. The dev server on port 3000 only accepts loopback connections.

**Admin Panel Access**: `Ctrl+Shift+A` or `?admin=true` URL param on frontend