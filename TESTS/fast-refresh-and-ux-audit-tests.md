# Fast Refresh Fix & UX Audit Test Plan

## Date: December 26, 2025
## Issue: Fast Refresh infinite loop caused by network error in HomeContent

---

## Background

The chat interface was experiencing ~500 Fast Refresh loops due to:
1. **NEXTAUTH_URL port mismatch**: `.env.local` had port 3002 (Docker) while local dev runs on port 3000
2. **Unhandled network errors** in `page.tsx` causing crash loop

---

## Fixes Applied

### 1. Environment Script Update (`scripts/update-lan-ip.sh`)
- Added `LOCAL_PORT=3000` constant
- Now updates both IP AND port in `.env.local`
- Ensures `NEXT_PUBLIC_BASE_URL` and `NEXTAUTH_URL` use correct local dev port

### 2. Error Handling in `page.tsx`
- Added specific handling for network errors in auth
- Redirects to `/login?error=network` instead of crashing
- Prevents infinite crash loop

### 3. Login Page Error Display
- Added `network` and `auth` error message handling
- Shows helpful message about NEXTAUTH_URL misconfiguration

### 4. UX Enhancement - Locked Premium Features
- FREE tier users now see locked Docs and Tools buttons
- Locked buttons use `<button>` with proper accessibility (not `<a>`)
- `relative` on button for correct lock icon positioning
- Tooltip shows "Upgrade to JIVE ↗" with 150ms delay on hover
- Added `z-10` to prevent tooltip clipping
- Proper `aria-label` for screen readers

---

## Test Cases

### TC-1: Local Dev Server Starts Without Fast Refresh Loop
**Preconditions:**
- Docker containers NOT running (or stopped for frontend)
- Clean `.next` cache

**Steps:**
1. Run `pnpm dev` in gogga-frontend
2. Open browser to https://192.168.0.130:3000
3. Observe console for 30 seconds

**Expected:**
- Only 1-2 initial Fast Refresh messages
- No repeated "rebuilding/done" loop
- Page loads successfully

**Pass Criteria:** ≤3 Fast Refresh cycles in 30 seconds

---

### TC-2: Network Error Redirects to Login
**Preconditions:**
- Backend NOT running (stopped)
- Frontend running

**Steps:**
1. Navigate to homepage (https://192.168.0.130:3000)
2. Observe behavior

**Expected:**
- Redirects to `/login?error=network`
- Error message displayed about network issue
- No crash loop

**Pass Criteria:** User sees login page with network error message

---

### TC-3: update-lan-ip.sh Updates Port Correctly
**Steps:**
1. Temporarily modify `.env.local` to have port 3002
2. Run `./scripts/update-lan-ip.sh`
3. Check `.env.local` contents

**Expected:**
- `NEXT_PUBLIC_BASE_URL=https://<LAN_IP>:3000`
- `NEXTAUTH_URL=https://<LAN_IP>:3000`

**Pass Criteria:** Port is 3000 (not 3002)

---

### TC-4: FREE Tier Shows Locked Premium Buttons
**Preconditions:**
- Logged in as FREE tier user
- Or use Admin Panel to switch to FREE tier

**Steps:**
1. Look at input area button bar
2. Find Docs and Tools buttons
3. Hover over locked button for 0.2 seconds
4. Click on a locked button

**Expected:**
- Both buttons appear with Lock icon in top-right corner
- Buttons are gray (not primary color)
- Hovering shows "Upgrade to JIVE ↗" tooltip after short delay
- Clicking navigates to `/upgrade`
- Screen reader announces "Premium feature, click to upgrade"

**Pass Criteria:** Locked buttons visible, accessible, and functional

---

### TC-5: JIVE/JIGGA Tier Shows Normal Buttons
**Preconditions:**
- Logged in as JIVE or JIGGA tier user
- Or use Admin Panel to switch tier

**Steps:**
1. Look at input area button bar
2. Find Docs and Tools buttons

**Expected:**
- Buttons appear in primary color (no lock icon)
- Clicking opens RightSidePanel
- Full functionality available

**Pass Criteria:** Premium features accessible

---

### TC-6: Docker vs Local Dev Port Isolation
**Steps:**
1. Start Docker with `docker compose up -d`
2. Note Docker frontend runs on port 3002
3. Also run local `pnpm dev` on port 3000
4. Access both in browser

**Expected:**
- https://192.168.0.130:3000 works (local dev)
- https://192.168.0.130:3002 works (Docker) - or mapped port
- No port conflicts

**Pass Criteria:** Both environments can run simultaneously

---

## Regression Checks

### RC-1: Voice (GoggaTalk) Button Works
- Click Voice button → Terminal should appear

### RC-2: Image Generation Works
- Type prompt → Click Image button → Image generates

### RC-3: Send Message Works
- Type message → Click Send → Message appears in chat

### RC-4: Auth Flow Works
- Sign out → Request magic link → Sign in → Redirected to chat

---

## Notes

- The `predev` script in package.json clears `.next` cache before each dev start
- This ensures no stale cache issues but means cold starts take longer
- Consider keeping Turbopack filesystem cache for faster restarts

---

## Related Files
- `gogga-frontend/scripts/update-lan-ip.sh`
- `gogga-frontend/src/app/page.tsx`
- `gogga-frontend/src/app/login/page.tsx`
- `gogga-frontend/src/app/ChatClient.tsx`
- `gogga-frontend/.env.local`

---

## Second Pass Improvements (Dec 26, 2025)

After initial implementation, a critical review identified and fixed:

| Issue | Original | Fixed |
|-------|----------|-------|
| Lock icon positioning | Parent had no `relative` | Added `relative` to button |
| Element type | `<a>` link | `<button>` with onClick |
| Accessibility | No ARIA | Added `aria-label` |
| Tooltip delay | Instant | Added `delay-150` |
| Tooltip z-index | Missing | Added `z-10` |
| Tooltip arrow | Plain text | Added "↗" indicator |

**Rationale:**
- Using `<button>` is semantically correct for interactive elements
- `relative` on button ensures lock icon positions correctly
- ARIA labels help screen reader users understand the feature
- Slight delay prevents tooltip from appearing during quick mouse movements
