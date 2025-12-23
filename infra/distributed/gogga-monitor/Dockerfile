# Gogga Monitor - Lightweight SSH-based system monitor
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir asyncssh websockets

# Copy application files
COPY ssh_monitor_bridge.py bridge_control_server.py LinuxMonitor.html ./

# Expose ports: 7080 for WebSocket, 7081 for control HTTP
EXPOSE 7080 7081

# Default command - run the control server which manages the bridge
CMD ["python", "bridge_control_server.py"]
