# CePO (Cerebras Planning Optimization) via optillm
FROM python:3.12-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install latest optillm and cerebras SDK (required for CePO)
RUN pip install --no-cache-dir --upgrade cerebras_cloud_sdk optillm math_verify

# CePO approach for enhanced reasoning
ENV OPTILLM_APPROACH=cepo
ENV OPTILLM_PORT=8080

EXPOSE 8080

# Start optillm - use cot_reflection instead of cepo (cepo adds reasoning_effort which Cerebras doesn't support)
CMD ["optillm", "--base-url", "https://api.cerebras.ai", "--approach", "cot_reflection", "--port", "8080"]
