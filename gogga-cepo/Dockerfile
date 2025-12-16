# GOGGA CePO - Cerebras Planning and Optimization Sidecar
# OptiLLM proxy with CePO approach for enhanced reasoning
#
# CePO combines:
# 1. Best of N sampling (3 candidates)
# 2. Chain-of-Thought reasoning
# 3. Self-Reflection
# 4. Self-Improvement
# 5. Systematic planning
#
# Expected improvement: +10-20% accuracy on reasoning tasks

FROM python:3.12-slim

LABEL maintainer="VCB-AI <dev@vcb-ai.online>"
LABEL description="OptiLLM CePO sidecar for GOGGA AI platform"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create non-root user for security
RUN groupadd -r optillm && useradd -r -g optillm optillm

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    optillm>=0.1.0 \
    cerebras_cloud_sdk>=1.0.0 \
    httpx>=0.26.0 \
    math_verify>=0.1.0

# Copy configuration
COPY cepo_config.yaml /app/cepo_config.yaml
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Switch to non-root user
USER optillm

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

# Run OptiLLM with CePO approach
# Config file sets: use_reasoning_fallback=false (critical for Cerebras - no reasoning_effort support)
CMD ["optillm", \
     "--base-url", "https://api.cerebras.ai", \
     "--approach", "cepo", \
     "--port", "8080", \
     "--cepo_config_file", "/app/cepo_config.yaml"]
