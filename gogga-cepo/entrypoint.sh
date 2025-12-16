#!/bin/bash
# GOGGA CePO Entrypoint
# Starts OptiLLM with CePO approach for Cerebras

set -e

# Validate required environment variables
if [ -z "$CEREBRAS_API_KEY" ]; then
    echo "ERROR: CEREBRAS_API_KEY is required"
    exit 1
fi

echo "Starting GOGGA CePO sidecar..."
echo "  Approach: cepo"
echo "  Base URL: https://api.cerebras.ai"
echo "  Port: 8080"
echo "  Best of N: ${CEPO_BESTOFN_N:-3}"
echo "  Planning N: ${CEPO_PLANNING_N:-3}"

# Start OptiLLM with CePO configuration
exec optillm \
    --base-url https://api.cerebras.ai \
    --approach cepo \
    --port 8080 \
    --model "${CEPO_DEFAULT_MODEL:-qwen-3-32b}" \
    --best-of-n "${CEPO_BESTOFN_N:-3}" \
    --cepo_bestofn_n "${CEPO_BESTOFN_N:-3}" \
    --cepo_bestofn_temperature "${CEPO_BESTOFN_TEMP:-0.1}" \
    --cepo_bestofn_max_tokens "${CEPO_BESTOFN_MAX_TOKENS:-4096}" \
    --cepo_bestofn_rating_type "${CEPO_RATING_TYPE:-absolute}" \
    --cepo_planning_n "${CEPO_PLANNING_N:-3}" \
    --cepo_planning_m "${CEPO_PLANNING_M:-6}" \
    --cepo_planning_temperature_step1 0.55 \
    --cepo_planning_temperature_step2 0.25 \
    --cepo_planning_temperature_step3 0.1 \
    --cepo_planning_temperature_step4 0.0 \
    --cepo_planning_max_tokens_step1 4096 \
    --cepo_planning_max_tokens_step2 4096 \
    --cepo_planning_max_tokens_step3 4096 \
    --cepo_planning_max_tokens_step4 4096 \
    --cepo_use_reasoning_fallback true \
    --cepo_num_of_retries 2 \
    "$@"
