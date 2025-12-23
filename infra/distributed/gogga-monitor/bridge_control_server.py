from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional


# ---- Config (Windows-friendly defaults for this workspace) ----
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))

# Prefer workspace venv python if present
DEFAULT_VENV_PY = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
PYTHON_EXE = os.environ.get("BRIDGE_PYTHON") or (DEFAULT_VENV_PY if os.path.exists(DEFAULT_VENV_PY) else sys.executable)

BRIDGE_SCRIPT = os.environ.get("BRIDGE_SCRIPT") or os.path.join(ROOT_DIR, "ssh_monitor_bridge.py")

CONTROL_HOST = os.environ.get("BRIDGE_CONTROL_HOST", "0.0.0.0")
CONTROL_PORT = int(os.environ.get("BRIDGE_CONTROL_PORT", "7081"))

OUT_LOG = os.environ.get("BRIDGE_STDOUT_LOG") or os.path.join(ROOT_DIR, "bridge.out.log")
ERR_LOG = os.environ.get("BRIDGE_STDERR_LOG") or os.path.join(ROOT_DIR, "bridge.err.log")

# Optional: report whether the WS bridge port looks reachable (even if started outside this controller)
BRIDGE_PROBE_HOST = os.environ.get("BRIDGE_PROBE_HOST", "127.0.0.1")
BRIDGE_PROBE_PORT = int(os.environ.get("BRIDGE_PROBE_PORT", "7080"))


_lock = threading.Lock()
_bridge_proc: Optional[subprocess.Popen] = None
_started_by_controller: bool = False
_bridge_out_f = None
_bridge_err_f = None


def _json_bytes(obj) -> bytes:
    return (json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def _proc_running(p: Optional[subprocess.Popen]) -> bool:
    return p is not None and p.poll() is None


def _tcp_reachable(host: str, port: int, timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _bridge_status() -> dict:
    with _lock:
        p = _bridge_proc
        started = _started_by_controller
        running = _proc_running(p)
        pid = p.pid if p is not None else None

    reachable = _tcp_reachable(BRIDGE_PROBE_HOST, BRIDGE_PROBE_PORT)

    return {
        "ok": True,
        "bridge": {
            "running": running,
            "pid": pid,
            "startedByController": started,
            "reachable": reachable,
            "probe": {"host": BRIDGE_PROBE_HOST, "port": BRIDGE_PROBE_PORT},
            "python": PYTHON_EXE,
            "script": BRIDGE_SCRIPT,
            "stdoutLog": OUT_LOG,
            "stderrLog": ERR_LOG,
        },
        "ts": int(time.time() * 1000),
    }


def _start_bridge() -> dict:
    global _bridge_proc, _started_by_controller, _bridge_out_f, _bridge_err_f

    if not os.path.exists(BRIDGE_SCRIPT):
        return {
            "ok": False,
            "error": f"Bridge script not found: {BRIDGE_SCRIPT}",
            "ts": int(time.time() * 1000),
        }

    # If something is already listening on the WS port, assume the bridge is already up.
    # (It may have been started manually or by a previous controller instance.)
    if _tcp_reachable(BRIDGE_PROBE_HOST, BRIDGE_PROBE_PORT):
        return {
            **_bridge_status(),
            "ok": True,
            "alreadyReachable": True,
            "message": f"Port {BRIDGE_PROBE_HOST}:{BRIDGE_PROBE_PORT} is already reachable; not starting another bridge.",
        }

    with _lock:
        if _proc_running(_bridge_proc):
            return {**_bridge_status(), "ok": True, "alreadyRunning": True}

        os.makedirs(os.path.dirname(OUT_LOG), exist_ok=True)
        os.makedirs(os.path.dirname(ERR_LOG), exist_ok=True)

        # Open log files in append mode and keep handles alive for the subprocess lifetime
        _bridge_out_f = open(OUT_LOG, "a", encoding="utf-8", errors="replace")
        _bridge_err_f = open(ERR_LOG, "a", encoding="utf-8", errors="replace")

        # Detached-ish on Windows: create a new process group.
        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        _bridge_proc = subprocess.Popen(
            [PYTHON_EXE, "-u", BRIDGE_SCRIPT],
            cwd=ROOT_DIR,
            stdout=_bridge_out_f,
            stderr=_bridge_err_f,
            stdin=subprocess.DEVNULL,
            creationflags=creationflags,
            text=True,
        )
        _started_by_controller = True

    # Give it a moment to bind the port and fail fast if it immediately exits
    time.sleep(0.4)
    with _lock:
        p = _bridge_proc
    if p is not None and p.poll() is not None:
        return {
            **_bridge_status(),
            "ok": False,
            "error": f"Bridge exited immediately with code {p.returncode}. Check logs.",
        }

    return {**_bridge_status(), "ok": True, "started": True}


def _stop_bridge() -> dict:
    global _bridge_proc, _started_by_controller, _bridge_out_f, _bridge_err_f

    with _lock:
        p = _bridge_proc
        started = _started_by_controller

        if not _proc_running(p):
            _bridge_proc = None
            _started_by_controller = False
            return {**_bridge_status(), "ok": True, "alreadyStopped": True}

        if not started:
            # Safety: don't kill arbitrary process we didn't spawn.
            return {
                **_bridge_status(),
                "ok": False,
                "error": "Bridge process is running but was not started by this controller. Refusing to stop it.",
            }

        # Terminate gracefully then kill
        if p is not None:
            try:
                p.terminate()
            except Exception:
                pass

    # wait outside lock
    if p is not None:
        try:
            p.wait(timeout=3)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass

    with _lock:
        _bridge_proc = None
        _started_by_controller = False
        try:
            if _bridge_out_f is not None:
                _bridge_out_f.flush()
        except Exception:
            pass
        try:
            if _bridge_err_f is not None:
                _bridge_err_f.flush()
        except Exception:
            pass
        _bridge_out_f = None
        _bridge_err_f = None

    return {**_bridge_status(), "ok": True, "stopped": True}


class Handler(BaseHTTPRequestHandler):
    server_version = "BridgeControl/1.0"

    def _set_headers(self, status: int = 200, content_type: str = "application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        # CORS for the single-file dashboard served from a different localhost port
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        path = (self.path or "").split("?", 1)[0]

        # Serve the dashboard at /dashboard or /monitor
        if path in {"/dashboard", "/monitor", "/ui"}:
            html_path = os.path.join(ROOT_DIR, "LinuxMonitor.html")
            if os.path.exists(html_path):
                self._set_headers(200, "text/html; charset=utf-8")
                with open(html_path, "rb") as f:
                    self.wfile.write(f.read())
                return
            self._set_headers(404, "text/plain; charset=utf-8")
            self.wfile.write(b"Dashboard not found\n")
            return

        if path in {"/", "/_/status"}:
            self._set_headers(200)
            self.wfile.write(_json_bytes(_bridge_status()))
            return

        if path == "/_/start":
            res = _start_bridge()
            self._set_headers(200 if res.get("ok") else 500)
            self.wfile.write(_json_bytes(res))
            return

        if path == "/_/stop":
            res = _stop_bridge()
            self._set_headers(200 if res.get("ok") else 409)
            self.wfile.write(_json_bytes(res))
            return

        self._set_headers(404, "text/plain; charset=utf-8")
        self.wfile.write(b"Not Found\n")

    def do_POST(self):
        # Allow POST as well (some environments prefer it)
        path = (self.path or "").split("?", 1)[0]
        if path == "/_/start":
            res = _start_bridge()
            self._set_headers(200 if res.get("ok") else 500)
            self.wfile.write(_json_bytes(res))
            return
        if path == "/_/stop":
            res = _stop_bridge()
            self._set_headers(200 if res.get("ok") else 409)
            self.wfile.write(_json_bytes(res))
            return

        self._set_headers(404, "text/plain; charset=utf-8")
        self.wfile.write(b"Not Found\n")

    def log_message(self, format, *args):
        # Keep console output quiet by default
        return


def main() -> None:
    httpd = ThreadingHTTPServer((CONTROL_HOST, CONTROL_PORT), Handler)
    print(f"Bridge control listening on http://{CONTROL_HOST}:{CONTROL_PORT}")
    print("Endpoints:")
    print("  GET  /_/status")
    print("  GET  /_/start")
    print("  GET  /_/stop")
    print("Logs:")
    print(f"  stdout: {OUT_LOG}")
    print(f"  stderr: {ERR_LOG}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
