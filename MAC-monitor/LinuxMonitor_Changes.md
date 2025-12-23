# LinuxMonitor.html — Single-file WebSocket Streaming Dashboard

This workspace keeps the monitoring dashboard as a **single HTML file** (`LinuxMonitor.html`).

## What changed (Dec 2025)

### No mock data (strict)
- Removed all random/simulated CPU/MEM/DISK/Docker values.
- The UI and charts update **only** from live streamed messages.
- When no live data is available, the dashboard shows **“—”** rather than faking `0%`.

### Hard-coded dev servers embedded in HTML
- The two home DMZ dev servers are embedded directly in the HTML markup under:
	- `<script type="application/json" id="builtin-servers">…</script>`
- They auto-connect on page load.

### Realtime charts + terminal
- UI is now rendered with **React (via CDN)**, still inside the same single HTML file.
- Added 3 per-server Chart.js line charts (CPU %, MEM %, DISK BUSY %).
- Added a terminal log area that behaves like a real terminal:
	- auto-scroll when you’re at the bottom
	- “scroll to bottom” button when you scroll up
	- bounded log size to prevent runaway memory

### Docker detection (automatic)
- On connect the page subscribes to a `docker` stream; Docker status is shown with a color indicator.
- The bridge also attempts to collect **per-container resource usage** via `docker stats --no-stream` and the UI renders a compact **Hot containers** list above each terminal (CPU %, MEM %, Block I/O).
- If the host is part of a Docker Swarm, the bridge also reports **swarm node context** (local node state; and if the host is a manager, `docker node ls` output). This makes it explicit that stats are collected per Docker node.

## Important: how “SSH streaming” works in a browser

Browsers **cannot** connect to SSH directly (no raw TCP/22). This dashboard expects a WebSocket bridge.

Default expected endpoint pattern:

- `ws://<server-ip>:8080/ssh-monitor`

This workspace typically runs a **local bridge** and points the built-in servers at it:

- `ws://localhost:8080/ssh-monitor`

## Minimal message protocol expected by the page

Client → Server:

- `{"type":"hello","client":"LinuxMonitor.html","version":1,"target":{"host":"192.168.x.x"}}`
- `{"type":"auth","username":"…","password":"…"}`
- `{"type":"subscribe","streams":{"metrics":true,"docker":true,"terminal":true},"intervalMs":5000}`

Server → Client:

- `{"type":"metrics","cpuPct":12.3,"memPct":44.1,"diskBusyPct":7.2,"uptime":"up 3 days","load1":0.12,"load5":0.08,"load15":0.05,"rootUsedPct":37.0,"latencyMs":12.4,"ts":1734758400000}`
- `{"type":"docker","status":"running","containers":[…],"stats":[…],"ts":…}` (`containers`/`stats` optional)
- `{"type":"docker","status":"running","containers":[…],"stats":[…],"statsError":"…","swarm":{…},"ts":…}` (`statsError`/`swarm` optional)

`swarm` (when available):

- `{"nodeName":"…","localNodeState":"active|inactive|…","isManager":true,"nodeId":"…","nodes":[{"id":"…","hostname":"…","status":"Ready","availability":"Active","managerStatus":"Leader"},…]}`

`stats` entries (shape may evolve):

- `{"id":"…","name":"…","image":"…","cpuPct":12.3,"memPct":4.5,"blockReadBytes":1234,"blockWriteBytes":5678,"blockTotalBytes":6912,"raw":{"cpu":"12.30%","memPct":"4.50%","blockIO":"1.2MB / 3.4MB"}}`
- `{"type":"terminal","line":"…","ts":…}` (or plain text lines)
- `{"type":"error","message":"…","ts":…}`

## Usage

- Open `LinuxMonitor.html` in your browser.
- The two built-in servers auto-connect.
- Use **Add Server** to add nodes (optionally override the WebSocket URL).
- Use **Remove** to remove nodes.

## Local quick-start (Windows)

This repo now includes a tiny Python WebSocket→SSH bridge:

- `ssh_monitor_bridge.py`

And an optional tiny **local control service** so you can **Start/Stop the bridge from inside the HTML dashboard**:

- `bridge_control_server.py`

Run it (from `c:\tmp`):

- Start the bridge: it listens on `ws://localhost:8080/ssh-monitor`
- Serve the HTML over HTTP (recommended) and open it in your browser

If you use the VS Code tasks/terminal, keep the bridge running while the dashboard is open.

## Start/Stop from the dashboard (recommended)

Because a browser cannot start/stop OS processes by itself, the dashboard talks to a small **local HTTP control server**:

- Control server base: `http://127.0.0.1:8081`
- Dashboard polls: `GET /_/status`
- Dashboard buttons:
	- `GET /_/start` (spawns `ssh_monitor_bridge.py`)
	- `GET /_/stop` (only stops the bridge if it was started by this controller)

The control server writes logs here:

- `bridge.out.log`
- `bridge.err.log`

Workflow:

1) Run `bridge_control_server.py` once (keep it running)
2) Open `LinuxMonitor.html`
3) Use **Start** / **Stop** in the header

Notes:

- If you start the bridge manually, the dashboard can still connect, but **Stop** is intentionally disabled (safety).
- If you click Stop, the dashboard pauses auto-reconnect so you don’t get endless reconnect spam.