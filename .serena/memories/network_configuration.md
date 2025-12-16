# Network Configuration for Gogga Development

## Next.js 16 LAN Access Bug

Next.js 16 has a bug where the dev server only accepts localhost connections even when bound to `0.0.0.0`. 

**Solution**: Bind to the specific LAN IP instead of `0.0.0.0`.

## Current Machine Network

- **WiFi Interface**: `wlp3s0` → `192.168.0.130` (DHCP, may change on reboot)
- **Ethernet**: `ens9` → `10.0.0.1`
- **ZeroTier**: `zt2lr3hxxc` → `10.241.135.171`
- **Docker**: `172.17.0.1`, `172.18.0.1`

## Auto-Update Script

A script at `gogga-frontend/scripts/update-lan-ip.sh` automatically detects the current LAN IP and updates:
1. `.env.local` - `NEXT_PUBLIC_BASE_URL` and `NEXTAUTH_URL`
2. `package.json` - `dev` script hostname

**The script runs automatically via `predev` hook when running `pnpm dev`.**

## Dev Server Commands

```bash
# Standard dev (auto-detects LAN IP)
pnpm dev

# Localhost only (no LAN access)
pnpm dev:localhost

# Force 0.0.0.0 binding (doesn't work with Next.js 16 bug)
pnpm dev:lan

# HTTP mode (no HTTPS)
pnpm dev:http
```

## Environment Variables

In `.env.local`:
```
NEXT_PUBLIC_BASE_URL=https://192.168.0.130:3000
NEXTAUTH_URL=https://192.168.0.130:3000
```

## Magic Link Authentication

Magic links are sent via EmailJS to `https://<LAN_IP>:3000/api/auth/verify-token?token=...`

The LAN IP must be correct for:
1. Token generation (server-side uses `NEXTAUTH_URL`)
2. Token verification (client accesses the URL from browser)

## HTTPS Certificates

Self-signed certificates in `gogga-frontend/certs/`:
- `cert.pem` - Certificate
- `key.pem` - Private key

Browser will show security warning - accept to proceed.

## Troubleshooting

### IP Changed After Reboot
```bash
# Run manually to update IP
./scripts/update-lan-ip.sh

# Or just run pnpm dev (predev runs the script)
pnpm dev
```

### Check Current IP
```bash
ip addr show | grep "inet " | grep wl
```

### Verify Dev Server Binding
```bash
ss -tlnp | grep 3000
```

### Test Connectivity
```bash
curl -k https://192.168.0.130:3000/api/auth/session
```
