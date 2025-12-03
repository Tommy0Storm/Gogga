"""
GOGGA Cost Tracker
Calculates precise token costs based on model pricing tiers.
Essential for unit economics analysis and subscription viability.
"""
import logging
from typing import TypedDict, Final

from app.config import settings


logger = logging.getLogger(__name__)

# Constants
MILLION: Final[int] = 1_000_000


class CostBreakdown(TypedDict):
    """Detailed cost breakdown."""
    input_tokens: int
    output_tokens: int
    input_cost_usd: float
    output_cost_usd: float


class UsageCost(TypedDict):
    """Usage cost response."""
    usd: float
    zar: float
    breakdown: CostBreakdown


class MonthlyEstimate(TypedDict):
    """Monthly cost estimate."""
    monthly_usd: float
    monthly_zar: float
    messages_per_month: int
    cost_per_message_usd: float


async def track_usage(
    user_id: str,
    model: str,
    layer: str,
    input_tokens: int,
    output_tokens: int
) -> UsageCost:
    """
    Calculates the cost of an interaction based on the specific model pricing.
    
    Pricing tiers (USD per Million Tokens):
    - Speed Layer (Llama 3.1 8B): $0.10 input, $0.10 output
    - Complex Layer (Qwen 3 235B): $0.60 input, $1.20 output
    
    Args:
        user_id: The user's unique identifier
        model: The model ID used for inference
        layer: Either "speed" or "complex"
        input_tokens: Number of input tokens consumed
        output_tokens: Number of output tokens generated
        
    Returns:
        UsageCost containing cost in USD, ZAR, and breakdown
    """
    # Determine Pricing Tier
    is_speed = layer == "speed" or model == settings.MODEL_SPEED
    
    if is_speed:
        input_cost_per_m = settings.COST_SPEED_INPUT
        output_cost_per_m = settings.COST_SPEED_OUTPUT
    else:
        input_cost_per_m = settings.COST_COMPLEX_INPUT
        output_cost_per_m = settings.COST_COMPLEX_OUTPUT
    
    # Calculate Cost (Input + Output)
    input_cost = (input_tokens / MILLION) * input_cost_per_m
    output_cost = (output_tokens / MILLION) * output_cost_per_m
    total_cost_usd = input_cost + output_cost
    
    # Convert to ZAR for local reporting
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    # Log the usage
    logger.info(
        "Usage tracked | user=%s | model=%s | layer=%s | "
        "input=%d | output=%d | cost=$%.6f (R%.4f)",
        user_id, model, layer, input_tokens, output_tokens,
        total_cost_usd, total_cost_zar
    )
    
    # TODO: In production, write to a 'ledger' table
    # await db.execute(
    #     "INSERT INTO token_ledger (user_id, model, layer, input_tokens, "
    #     "output_tokens, cost_usd, cost_zar, exchange_rate) VALUES (...)"
    # )
    
    return {
        "usd": round(total_cost_usd, 8),
        "zar": round(total_cost_zar, 6),
        "breakdown": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost_usd": round(input_cost, 8),
            "output_cost_usd": round(output_cost, 8)
        }
    }


def calculate_monthly_cost_estimate(
    avg_messages_per_day: int,
    avg_input_tokens: int = 200,
    avg_output_tokens: int = 500,
    complex_ratio: float = 0.2
) -> MonthlyEstimate:
    """
    Calculate estimated monthly cost for a user based on usage patterns.
    
    Args:
        avg_messages_per_day: Average number of messages per day
        avg_input_tokens: Average input tokens per message
        avg_output_tokens: Average output tokens per message
        complex_ratio: Ratio of messages using the Complex layer (0.0 to 1.0)
        
    Returns:
        MonthlyEstimate with monthly cost estimates in USD and ZAR
    """
    messages_per_month = avg_messages_per_day * 30
    
    speed_messages = messages_per_month * (1 - complex_ratio)
    complex_messages = messages_per_month * complex_ratio
    
    # Speed Layer costs
    speed_input_cost = (speed_messages * avg_input_tokens / MILLION) * settings.COST_SPEED_INPUT
    speed_output_cost = (speed_messages * avg_output_tokens / MILLION) * settings.COST_SPEED_OUTPUT
    
    # Complex Layer costs
    complex_input_cost = (complex_messages * avg_input_tokens / MILLION) * settings.COST_COMPLEX_INPUT
    complex_output_cost = (complex_messages * avg_output_tokens / MILLION) * settings.COST_COMPLEX_OUTPUT
    
    total_usd = speed_input_cost + speed_output_cost + complex_input_cost + complex_output_cost
    total_zar = total_usd * settings.ZAR_USD_RATE
    
    return {
        "monthly_usd": round(total_usd, 4),
        "monthly_zar": round(total_zar, 2),
        "messages_per_month": messages_per_month,
        "cost_per_message_usd": round(total_usd / messages_per_month, 6) if messages_per_month > 0 else 0.0
    }
