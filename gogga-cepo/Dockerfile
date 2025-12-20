# GOGGA CePO - Cerebras Planning and Optimization Sidecar
# Uses official OptILLM image with CePO approach for enhanced reasoning
#
# CePO combines:
# 1. Best of N sampling (3 candidates)
# 2. Chain-of-Thought reasoning
# 3. Self-Reflection
# 4. Self-Improvement
# 5. Systematic planning
#
# Expected improvement: +10-20% accuracy on reasoning tasks

FROM ghcr.io/algorithmicsuperintelligence/optillm:latest-proxy

LABEL maintainer="VCB-AI <dev@vcb-ai.online>"
LABEL description="OptiLLM CePO sidecar for GOGGA AI platform"
LABEL version="2.0.0"

# Copy configuration
COPY cepo_config.yaml /app/cepo_config.yaml

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

EXPOSE 8080

# CePO configuration via environment variables (set in docker-compose.yml)
# OPTILLM_APPROACH=cepo
# CEREBRAS_API_KEY=<from env>
