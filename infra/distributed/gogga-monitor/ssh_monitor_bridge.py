from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import sys

import asyncssh
import websockets
from websockets.asyncio.server import ServerConnection
from websockets.http11 import Response


PATH = "/ssh-monitor"
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 7080

BRIDGE_BUILD = "2025-12-23-gogga-distributed-v1"

# How often to (re)check Docker status by default (seconds)
# Keep this reasonably small so the UI "Hot containers" panel feels alive.
DEFAULT_DOCKER_INTERVAL_S = 10


@dataclass
class CpuSample:
    total: int
    idle: int


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


async def _safe_send(ws: ServerConnection, payload: Dict[str, Any]) -> None:
    if ws.state.name != 'OPEN':
        return
    try:
        await ws.send(_json_dumps(payload))
    except Exception:
        # Client likely gone
        return


async def _send_terminal(ws: ServerConnection, line: str) -> None:
    await _safe_send(ws, {"type": "terminal", "line": line, "ts": int(time.time() * 1000)})


async def _send_error(ws: ServerConnection, message: str) -> None:
    await _safe_send(ws, {"type": "error", "message": message, "ts": int(time.time() * 1000)})


async def _run_cmd(conn: asyncssh.SSHClientConnection, command: str, timeout: float = 10.0) -> Tuple[int, str, str]:
    """Run a command and return (exit_status, stdout, stderr)."""
    try:
        r = await asyncio.wait_for(conn.run(command, check=False), timeout=timeout)
        code = r.exit_status if r.exit_status is not None else 1
        return (int(code), str(r.stdout or ""), str(r.stderr or ""))
    except asyncio.TimeoutError:
        return (124, "", f"timeout running: {command}")
    except Exception as e:
        return (1, "", f"error running {command}: {e}")


def _parse_proc_stat_first_line(text: str) -> Optional[CpuSample]:
    # Expect: cpu  4705 150 2290 136239 ...
    m = re.match(r"^cpu\s+(.*)$", text.strip())
    if not m:
        return None
    parts = m.group(1).split()
    if len(parts) < 4:
        return None
    nums = []
    for p in parts:
        try:
            nums.append(int(p))
        except Exception:
            return None
    total = sum(nums)
    idle = nums[3] + (nums[4] if len(nums) > 4 else 0)  # idle + iowait
    return CpuSample(total=total, idle=idle)


def _cpu_pct(prev: CpuSample, cur: CpuSample) -> Optional[float]:
    dt = cur.total - prev.total
    di = cur.idle - prev.idle
    if dt <= 0:
        return None
    used = dt - di
    return max(0.0, min(100.0, (used / dt) * 100.0))


def _mem_pct_from_meminfo(text: str) -> Optional[float]:
    # Parse MemTotal and MemAvailable
    total_kb = None
    avail_kb = None
    for line in text.splitlines():
        if line.startswith("MemTotal:"):
            total_kb = int(line.split()[1])
        elif line.startswith("MemAvailable:"):
            avail_kb = int(line.split()[1])
        if total_kb is not None and avail_kb is not None:
            break
    if not total_kb or avail_kb is None:
        return None
    used_kb = total_kb - avail_kb
    return max(0.0, min(100.0, (used_kb / total_kb) * 100.0))


def _load_avgs_from_loadavg(text: str) -> Tuple[Optional[float], Optional[float], Optional[float]]:
    # /proc/loadavg: "0.27 0.33 0.28 1/123 4567"
    parts = text.strip().split()
    if len(parts) < 3:
        return (None, None, None)
    try:
        return (float(parts[0]), float(parts[1]), float(parts[2]))
    except Exception:
        return (None, None, None)


def _root_used_pct_from_df_line(text: str) -> Optional[float]:
    # df -P / (POSIX): Filesystem 1024-blocks Used Available Capacity Mounted on
    # We want Capacity (e.g. 37%)
    line = text.strip()
    if not line:
        return None
    cols = line.split()
    # Try last occurrence of something like "NN%"
    for c in reversed(cols):
        if c.endswith("%"):
            try:
                return float(c[:-1])
            except Exception:
                return None
    return None


async def _disk_busy_pct(conn: asyncssh.SSHClientConnection) -> Tuple[Optional[float], Optional[str]]:
    """Best-effort disk busy time % using iostat. Returns (pct, warning)."""
    # Check if iostat exists
    code, out, _ = await _run_cmd(conn, "command -v iostat", timeout=5)
    if code != 0 or not out.strip():
        return (None, "iostat not found; install sysstat to get DISK BUSY TIME %")

    # iostat -dx: %util per device. Use second sample for accuracy.
    cmd = "LC_ALL=C iostat -dx 1 2"
    code, out, err = await _run_cmd(conn, cmd, timeout=8)
    if code != 0:
        return (None, f"iostat failed: {err.strip() or 'unknown error'}")

    lines = out.splitlines()
    # Grab the last 'Device' table
    last_device_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("Device"):
            last_device_idx = i
    if last_device_idx is None:
        return (None, "could not parse iostat output")

    table = lines[last_device_idx + 1 :]
    utils = []
    for line in table:
        line = line.strip()
        if not line:
            continue
        cols = line.split()
        # Heuristic: last column is %util
        if len(cols) < 2:
            continue
        dev = cols[0]
        if dev.startswith("loop"):
            continue
        try:
            util = float(cols[-1])
        except Exception:
            continue
        # Filter out obvious headers
        if dev.lower() in {"device"}:
            continue
        utils.append(util)

    if not utils:
        return (None, "no devices parsed from iostat")

    # Average %util across devices
    return (sum(utils) / len(utils), None)


async def _docker_status(conn: asyncssh.SSHClientConnection) -> Dict[str, Any]:
    # Detect docker binary
    code, out, _ = await _run_cmd(conn, "command -v docker", timeout=5)
    if code != 0 or not out.strip():
        return {
            "status": "not installed",
            "containers": None,
            "stats": None,
            "statsError": None,
            "swarm": None,
            "usedSudo": False,
            "daemonError": None,
        }

    # Detect daemon status (capture error text; don't redirect away stderr)
    docker_prefix = ""
    code, out, err = await _run_cmd(conn, "docker info --format '{{.ServerVersion}}'", timeout=10)
    daemon_error = None
    if code != 0:
        # Common case: user cannot access /var/run/docker.sock.
        combined = (err or out or "").strip()
        if combined:
            daemon_error = combined.splitlines()[0][:240]

        # Try passwordless sudo if available.
        code2, out2, err2 = await _run_cmd(conn, "sudo -n docker info --format '{{.ServerVersion}}'", timeout=10)
        if code2 == 0:
            docker_prefix = "sudo -n "
            code, out, err = code2, out2, err2
            daemon_error = None

    if code == 0:
        swarm = await _docker_swarm_info(conn, docker_prefix=docker_prefix)

        # Containers (best-effort)
        code2, out2, _ = await _run_cmd(
            conn,
            f"{docker_prefix}docker ps --format '{{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}'",
            timeout=10,
        )
        containers = []
        image_by_id: Dict[str, str] = {}
        if code2 == 0:
            for line in out2.splitlines():
                parts = line.split("\t")
                if len(parts) >= 4:
                    cid = parts[0]
                    image_by_id[cid] = parts[1]
                    containers.append(
                        {
                            "id": cid,
                            "image": parts[1],
                            "name": parts[2],
                            "status": parts[3],
                        }
                    )

        stats, stats_err = await _docker_container_stats(conn, image_by_id=image_by_id, docker_prefix=docker_prefix)
        return {
            "status": "running",
            "containers": containers,
            "stats": stats,
            "statsError": stats_err,
            "swarm": swarm,
            "usedSudo": bool(docker_prefix),
            "daemonError": None,
        }

    # Nonzero: daemon likely stopped or permission issue
    # If we have a meaningful error, surface it.
    if daemon_error:
        # Heuristic: permission-denied to docker sock => unknown (not necessarily stopped)
        lowered = daemon_error.lower()
        if "permission denied" in lowered or "got permission denied" in lowered:
            return {
                "status": "unknown",
                "containers": None,
                "stats": None,
                "statsError": None,
                "swarm": None,
                "usedSudo": False,
                "daemonError": daemon_error,
            }

    return {
        "status": "stopped",
        "containers": None,
        "stats": None,
        "statsError": None,
        "swarm": None,
        "usedSudo": False,
        "daemonError": daemon_error,
    }


async def _docker_swarm_info(conn: asyncssh.SSHClientConnection, docker_prefix: str = "") -> Optional[Dict[str, Any]]:
    """Detect Docker Swarm state and, when on a manager, list swarm nodes.

    This lets the dashboard show that stats are being collected per-node.
    """
    # Use a compact format to avoid parsing huge docker info output.
    fmt = "{{.Name}}|{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}|{{.Swarm.NodeID}}"
    code, out, _ = await _run_cmd(conn, f"{docker_prefix}docker info --format '{fmt}'", timeout=10)
    if code != 0:
        return None

    parts = out.strip().split("|")
    if len(parts) != 4:
        return None

    node_name, local_state, control_avail, node_id = parts
    is_manager = str(control_avail).strip().lower() == "true"
    state = str(local_state).strip().lower() if local_state else "unknown"

    info: Dict[str, Any] = {
        "nodeName": node_name.strip() or None,
        "localNodeState": state,
        "isManager": is_manager,
        "nodeId": node_id.strip() or None,
        "nodes": None,
    }

    # Only managers can list nodes.
    if not is_manager or state != "active":
        return info

    code2, out2, _ = await _run_cmd(
        conn,
        f"{docker_prefix}docker node ls --format '{{.ID}}\t{{.Hostname}}\t{{.Status}}\t{{.Availability}}\t{{.ManagerStatus}}'",
        timeout=10,
    )
    if code2 != 0:
        return info

    nodes = []
    for line in out2.splitlines():
        cols = line.split("\t")
        if len(cols) < 5:
            continue
        nodes.append(
            {
                "id": cols[0],
                "hostname": cols[1],
                "status": cols[2],
                "availability": cols[3],
                "managerStatus": cols[4],
            }
        )
    info["nodes"] = nodes
    return info


def _parse_pct(s: str) -> Optional[float]:
    try:
        t = s.strip().replace("%", "")
        return float(t)
    except Exception:
        return None


_SIZE_RE = re.compile(r"^\s*([0-9]*\.?[0-9]+)\s*([kKmMgGtTpP]?[iI]?[bB])?\s*$")


def _parse_size_to_bytes(s: str) -> Optional[float]:
    # Accept docker-style units like "12.3MiB", "1.2GB", "456kB", "0B"
    t = (s or "").strip()
    if not t:
        return None
    if t.lower() == "0b":
        return 0.0

    m = _SIZE_RE.match(t)
    if not m:
        return None
    val = float(m.group(1))
    unit = (m.group(2) or "B").upper()

    # Normalize
    unit = unit.replace("IB", "iB")  # keep KiB/MiB etc recognizable

    # Binary
    if unit in {"B"}:
        mul = 1
    elif unit in {"KIB"}:
        mul = 1024
    elif unit in {"MIB"}:
        mul = 1024**2
    elif unit in {"GIB"}:
        mul = 1024**3
    elif unit in {"TIB"}:
        mul = 1024**4
    elif unit in {"PIB"}:
        mul = 1024**5
    # Decimal
    elif unit in {"KB"}:
        mul = 1000
    elif unit in {"MB"}:
        mul = 1000**2
    elif unit in {"GB"}:
        mul = 1000**3
    elif unit in {"TB"}:
        mul = 1000**4
    elif unit in {"PB"}:
        mul = 1000**5
    else:
        return None

    return val * mul


def _parse_io_pair(s: str) -> Tuple[Optional[float], Optional[float]]:
    # docker prints like "12.3MB / 4.5MB"
    t = (s or "").strip()
    if not t:
        return (None, None)
    if "/" not in t:
        b = _parse_size_to_bytes(t)
        return (b, None)
    left, right = [p.strip() for p in t.split("/", 1)]
    return (_parse_size_to_bytes(left), _parse_size_to_bytes(right))


async def _docker_container_stats(
    conn: asyncssh.SSHClientConnection,
    image_by_id: Dict[str, str],
    docker_prefix: str = "",
) -> Tuple[Optional[list[Dict[str, Any]]], Optional[str]]:
    """Return (per-container docker stats, error_message).

    If stats are unavailable, returns (None, reason).
    """
    fmt = "{{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}"
    base_cmd = f"{docker_prefix}docker stats --no-stream --format '{fmt}'"
    code, out, err = await _run_cmd(conn, base_cmd, timeout=12)
    if code != 0:
        err_l = (err or "").strip()
        out_l = (out or "").strip()
        # Common case: user cannot access /var/run/docker.sock.
        # Try passwordless sudo if available (only when not already using sudo).
        combined_l = (err_l or out_l or "").lower()
        if not docker_prefix and ("permission denied" in combined_l or "got permission denied" in combined_l):
            code2, out2, err2 = await _run_cmd(conn, f"sudo -n {base_cmd}", timeout=12)
            if code2 == 0:
                out, err = out2, err2
            else:
                reason = (err2 or out2 or err_l or out_l or "docker stats failed").strip()
                return (None, reason.splitlines()[0][:240])
        else:
            reason = (err_l or out_l or "docker stats failed").strip()
            return (None, reason.splitlines()[0][:240])

    stats: list[Dict[str, Any]] = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) < 8:
            continue
        cid, name, cpu_s, mempct_s, memusage_s, netio_s, blockio_s, pids_s = parts[:8]

        cpu_pct = _parse_pct(cpu_s)
        mem_pct = _parse_pct(mempct_s)

        # MemUsage like "12.3MiB / 1.944GiB"
        mem_used_b, mem_limit_b = _parse_io_pair(memusage_s)
        net_rx_b, net_tx_b = _parse_io_pair(netio_s)
        blk_r_b, blk_w_b = _parse_io_pair(blockio_s)
        blk_total_b = None
        if blk_r_b is not None or blk_w_b is not None:
            blk_total_b = float((blk_r_b or 0.0) + (blk_w_b or 0.0))

        try:
            pids = int(pids_s.strip())
        except Exception:
            pids = None

        stats.append(
            {
                "id": cid,
                "name": name,
                "image": image_by_id.get(cid),
                "cpuPct": cpu_pct,
                "memPct": mem_pct,
                "memUsedBytes": mem_used_b,
                "memLimitBytes": mem_limit_b,
                "netRxBytes": net_rx_b,
                "netTxBytes": net_tx_b,
                "blockReadBytes": blk_r_b,
                "blockWriteBytes": blk_w_b,
                "blockTotalBytes": blk_total_b,
                "pids": pids,
                "raw": {
                    "cpu": cpu_s,
                    "memPct": mempct_s,
                    "memUsage": memusage_s,
                    "netIO": netio_s,
                    "blockIO": blockio_s,
                    "pids": pids_s,
                },
            }
        )

    return (stats, None)


class Session:
    def __init__(self, ws: ServerConnection):
        self.ws = ws
        self.target_host: Optional[str] = None
        self.username: Optional[str] = None
        self.password: Optional[str] = None
        self.use_key: bool = False  # SSH key auth instead of password
        self.interval_ms: int = 5000
        self.want_metrics: bool = False
        self.want_docker: bool = False
        self.want_terminal: bool = False
        self.conn: Optional[asyncssh.SSHClientConnection] = None
        self._tasks: list[asyncio.Task] = []
        self._cpu_prev: Optional[CpuSample] = None
        self._last_disk_warn_sent_s: float = 0.0

    async def close(self) -> None:
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()
        if self.conn is not None:
            try:
                self.conn.close()
                await self.conn.wait_closed()
            except Exception:
                pass
            self.conn = None

    async def ensure_ssh(self) -> Optional[asyncssh.SSHClientConnection]:
        if self.conn is not None:
            return self.conn

        if not self.target_host or not self.username:
            await _send_error(self.ws, "Missing target/auth (need hello.target.host + auth.username)")
            return None
        
        # Require either password or key-based auth
        if not self.use_key and not self.password:
            await _send_error(self.ws, "Missing auth (need password or useKey=true)")
            return None

        await _send_terminal(self.ws, f"SSH connecting to {self.username}@{self.target_host}…")

        try:
            # known_hosts=None disables host key verification (convenient, less secure)
            if self.use_key:
                # Explicitly specify key files (mounted from host)
                import os
                key_paths = []
                for key_name in ['id_ed25519', 'id_rsa', 'id_ecdsa']:
                    key_path = f'/root/.ssh/{key_name}'
                    if os.path.exists(key_path):
                        key_paths.append(key_path)
                
                if not key_paths:
                    await _send_error(self.ws, "No SSH keys found in /root/.ssh/")
                    return None
                
                await _send_terminal(self.ws, f"Using SSH keys: {', '.join(key_paths)}")
                self.conn = await asyncssh.connect(
                    self.target_host,
                    username=self.username,
                    client_keys=key_paths,
                    known_hosts=None,
                )
            else:
                self.conn = await asyncssh.connect(
                    self.target_host,
                    username=self.username,
                    password=self.password,
                    known_hosts=None,
                )
            print(f"[ssh] connected user={self.username} target={self.target_host}")
            await _send_terminal(self.ws, f"SSH connected to {self.target_host}")
            self._cpu_prev = None
            return self.conn
        except Exception as e:
            self.conn = None
            print(f"[ssh] connect failed user={self.username} target={self.target_host} err={e}")
            await _send_error(self.ws, f"SSH connect failed: {e}")
            return None

    def start_streams(self) -> None:
        # Cancel existing tasks first
        for t in self._tasks:
            t.cancel()
        self._tasks.clear()

        if self.want_metrics:
            self._tasks.append(asyncio.create_task(self._metrics_loop(), name="metrics"))
        if self.want_docker:
            self._tasks.append(asyncio.create_task(self._docker_loop(), name="docker"))

    async def _metrics_loop(self) -> None:
        while True:
            try:
                conn = await self.ensure_ssh()
                if conn is None:
                    await asyncio.sleep(2)
                    continue

                # Best-effort latency measurement (network + remote exec)
                t0 = time.perf_counter()
                code_lat, _, _ = await _run_cmd(conn, "true", timeout=3)
                latency_ms = (time.perf_counter() - t0) * 1000.0 if code_lat == 0 else None

                # CPU sample
                code, out, err = await _run_cmd(conn, "head -n 1 /proc/stat", timeout=5)
                if code != 0:
                    await _send_terminal(self.ws, f"WARN: /proc/stat read failed: {err.strip()}")
                    await asyncio.sleep(self.interval_ms / 1000)
                    continue

                cur_sample = _parse_proc_stat_first_line(out)
                cpu_pct = None
                if cur_sample and self._cpu_prev:
                    cpu_pct = _cpu_pct(self._cpu_prev, cur_sample)
                self._cpu_prev = cur_sample

                # Mem
                code, out, err = await _run_cmd(conn, "cat /proc/meminfo", timeout=5)
                mem_pct = None
                if code == 0:
                    mem_pct = _mem_pct_from_meminfo(out)
                else:
                    await _send_terminal(self.ws, f"WARN: /proc/meminfo read failed: {err.strip()}")

                # Disk busy
                disk_busy, disk_warn = await _disk_busy_pct(conn)
                if disk_warn:
                    now_s = time.time()
                    # Rate-limit to avoid terminal spam
                    if (now_s - self._last_disk_warn_sent_s) > 60:
                        self._last_disk_warn_sent_s = now_s
                        await _send_terminal(self.ws, f"INFO: {disk_warn}")

                # Load average
                code, out, err = await _run_cmd(conn, "cat /proc/loadavg", timeout=5)
                if code == 0:
                    load1, load5, load15 = _load_avgs_from_loadavg(out)
                else:
                    load1, load5, load15 = (None, None, None)
                    await _send_terminal(self.ws, f"WARN: /proc/loadavg read failed: {err.strip()}")

                # Root filesystem used %
                code, out, err = await _run_cmd(conn, "df -P / | tail -n 1", timeout=5)
                root_used_pct = _root_used_pct_from_df_line(out) if code == 0 else None
                if code != 0:
                    await _send_terminal(self.ws, f"WARN: df / failed: {err.strip()}")

                # Uptime
                code, out, _ = await _run_cmd(conn, "uptime -p", timeout=5)
                uptime = out.strip() if code == 0 else None

                payload = {
                    "type": "metrics",
                    "cpuPct": cpu_pct,
                    "memPct": mem_pct,
                    "diskBusyPct": disk_busy,
                    "uptime": uptime,
                    "load1": load1,
                    "load5": load5,
                    "load15": load15,
                    "rootUsedPct": root_used_pct,
                    "latencyMs": latency_ms,
                    "ts": int(time.time() * 1000),
                }
                await _safe_send(self.ws, payload)

                await asyncio.sleep(self.interval_ms / 1000)
            except asyncio.CancelledError:
                return
            except Exception as e:
                await _send_error(self.ws, f"metrics loop error: {e}")
                await asyncio.sleep(2)

    async def _docker_loop(self) -> None:
        last_stats_err_sent: Optional[str] = None
        while True:
            try:
                conn = await self.ensure_ssh()
                if conn is None:
                    await asyncio.sleep(2)
                    continue

                info = await _docker_status(conn)
                # If docker stats fails, surface the reason in the terminal (rate-limited to changes)
                if info.get("status") == "running" and info.get("stats") is None:
                    se = info.get("statsError")
                    if isinstance(se, str) and se.strip():
                        se_s = se.strip()
                        if se_s != last_stats_err_sent:
                            last_stats_err_sent = se_s
                            await _send_terminal(self.ws, f"WARN: docker stats failed: {se_s}")

                payload = {
                    "type": "docker",
                    "status": info.get("status", "unknown"),
                    "containers": info.get("containers"),
                    "stats": info.get("stats"),
                    "statsError": info.get("statsError"),
                    "swarm": info.get("swarm"),
                    "ts": int(time.time() * 1000),
                }
                await _safe_send(self.ws, payload)

                await asyncio.sleep(DEFAULT_DOCKER_INTERVAL_S)
            except asyncio.CancelledError:
                return
            except Exception as e:
                await _send_error(self.ws, f"docker loop error: {e}")
                await asyncio.sleep(5)


async def handler(ws: ServerConnection) -> None:
    session = Session(ws)
    peer = None
    try:
        peer = ws.remote_address
    except Exception:
        peer = None

    print(f"[ws] client connected: {peer}")
    await _safe_send(
        ws,
        {
            "type": "bridge_info",
            "build": BRIDGE_BUILD,
            "python": sys.version.split()[0],
            "path": PATH,
            "capabilities": {
                "dockerStats": True,
                "dockerStatsSudoFallback": True,
                "dockerSwarm": True,
                "statsError": True,
                "daemonError": True,
                "usedSudo": True,
            },
            "ts": int(time.time() * 1000),
        },
    )
    await _send_terminal(ws, f"WS bridge connected (build {BRIDGE_BUILD})")

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception:
                await _send_terminal(ws, f"(client) {str(raw)[:200]}")
                continue

            mtype = msg.get("type")

            if mtype == "hello":
                target = msg.get("target") or {}
                host = target.get("host")
                if host:
                    session.target_host = str(host)
                    print(f"[ws] hello target={session.target_host} peer={peer}")
                    await _send_terminal(ws, f"Target host set to {session.target_host}")
                continue

            if mtype == "auth":
                session.username = msg.get("username")
                session.password = msg.get("password")
                session.use_key = bool(msg.get("useKey", False))
                auth_type = "key" if session.use_key else "password"
                print(f"[ws] auth user={session.username} target={session.target_host} type={auth_type} peer={peer}")
                await _send_terminal(ws, f"Auth received ({auth_type})")
                # Attempt connect now (so errors show immediately)
                await session.ensure_ssh()
                continue

            if mtype == "subscribe":
                streams = msg.get("streams") or {}
                session.want_metrics = bool(streams.get("metrics"))
                session.want_docker = bool(streams.get("docker"))
                session.want_terminal = bool(streams.get("terminal"))
                interval_ms = msg.get("intervalMs")
                if isinstance(interval_ms, (int, float)):
                    session.interval_ms = int(max(1000, min(60_000, interval_ms)))
                print(
                    f"[ws] subscribe target={session.target_host} metrics={session.want_metrics} docker={session.want_docker} intervalMs={session.interval_ms} peer={peer}"
                )
                await _send_terminal(ws, f"Subscribed: metrics={session.want_metrics} docker={session.want_docker} intervalMs={session.interval_ms}")
                session.start_streams()
                continue

            await _send_terminal(ws, f"Unknown message type: {mtype}")

    except websockets.ConnectionClosed:
        return
    finally:
        print(f"[ws] client disconnected: {peer}")
        await session.close()


async def process_request(connection: ServerConnection, request) -> Response | None:
    # Reject non-matching paths with 404 (prevents confusing handshake errors)
    if request.path != PATH:
        return connection.respond(404, "Not Found")
    return None


async def main() -> None:
    print(f"Starting SSH monitor WebSocket bridge on ws://{LISTEN_HOST}:{LISTEN_PORT}{PATH}")
    print(f"Bridge build: {BRIDGE_BUILD}")
    print(f"Python: {sys.executable}")
    print("This is a local bridge. It will SSH to target hosts using credentials provided by the dashboard.")
    print("Stop with Ctrl+C")

    async with websockets.serve(
        handler,
        LISTEN_HOST,
        LISTEN_PORT,
        process_request=process_request,
        max_size=2**20,
        ping_interval=20,
        ping_timeout=20,
    ):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
