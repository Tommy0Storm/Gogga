# ============================
# GOGGA Backend - Railway Deployment
# Python 3.14 FastAPI + OptiLLM (CePO in-process)
# ============================
FROM python:3.14-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY gogga-backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ============================
# Stage 2: Runtime
# ============================
FROM python:3.14-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy backend code (includes CePO/OptiLLM)
COPY gogga-backend/app ./app

# Railway provides PORT environment variable
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start FastAPI (CePO/OptiLLM runs in-process)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
