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
    output_tokens: int,
    tier: str = "free"
) -> UsageCost:
    """
    Calculates the cost of an interaction based on tier and model pricing.
    
    Pricing tiers (USD per Million Tokens):
    - FREE tier: $0.00 (still tracked for usage limits)
    - JIVE tier (Llama 3.3 70B): $0.10 input, $0.10 output
    - JIGGA tier (Qwen 3 32B): $0.40 input, $0.80 output
    
    Args:
        user_id: The user's unique identifier (email-based)
        model: The model ID used for inference
        layer: The cognitive layer used
        input_tokens: Number of input tokens consumed
        output_tokens: Number of output tokens generated
        tier: User tier: "free", "jive", or "jigga"
        
    Returns:
        UsageCost containing cost in USD, ZAR, and breakdown
    """
    # Determine Pricing by Tier
    tier_lower = tier.lower()
    
    if tier_lower == "jigga":
        # JIGGA: Qwen 3 32B pricing
        input_cost_per_m = settings.COST_JIGGA_INPUT   # $0.40
        output_cost_per_m = settings.COST_JIGGA_OUTPUT  # $0.80
    elif tier_lower == "jive":
        # JIVE: Llama 3.3 70B pricing
        input_cost_per_m = settings.COST_JIVE_INPUT   # $0.10
        output_cost_per_m = settings.COST_JIVE_OUTPUT  # $0.10
    else:
        # FREE: No cost but still track tokens
        input_cost_per_m = settings.COST_FREE_INPUT   # $0.00
        output_cost_per_m = settings.COST_FREE_OUTPUT  # $0.00
    
    # Calculate Cost (Input + Output)
    input_cost = (input_tokens / MILLION) * input_cost_per_m
    output_cost = (output_tokens / MILLION) * output_cost_per_m
    total_cost_usd = input_cost + output_cost
    
    # Convert to ZAR for local reporting
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    # Log the usage
    logger.info(
        "Usage tracked | user=%s | tier=%s | model=%s | layer=%s | "
        "input=%d | output=%d | cost=$%.6f (R%.4f)",
        user_id, tier, model, layer, input_tokens, output_tokens,
        total_cost_usd, total_cost_zar
    )
    
    # TODO: In production, write to a 'ledger' table with email as primary key
    # await db.execute(
    #     "INSERT INTO token_ledger (user_email, tier, model, layer, input_tokens, "
    #     "output_tokens, cost_usd, cost_zar, exchange_rate, timestamp) VALUES (...)"
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


async def track_image_usage(
    user_id: str,
    tier: str,
    generator: str,
    image_count: int = 1
) -> UsageCost:
    """
    Track image generation usage and cost.
    
    Pricing:
    - FREE tier (Pollinations.ai): $0.00 per image
    - JIVE/JIGGA tier tool calling (Pollinations.ai): $0.00 per image
    - JIVE/JIGGA tier GOGGA Pro (FLUX 1.1 Pro): $0.04 per image
    
    Args:
        user_id: The user's unique identifier (email-based)
        tier: User tier: "free", "jive", or "jigga"
        generator: Image generator used: "pollinations", "longcat" (legacy), or "flux"
        image_count: Number of images generated
        
    Returns:
        UsageCost containing cost in USD and ZAR
    """
    tier_lower = tier.lower()
    
    # Determine cost per image
    # Pollinations.ai and LongCat (legacy) are free
    generator_lower = generator.lower()
    if tier_lower == "free" or generator_lower in ("pollinations", "longcat"):
        cost_per_image = settings.COST_LONGCAT_IMAGE  # $0.00
    else:
        cost_per_image = settings.COST_FLUX_IMAGE  # $0.04
    
    total_cost_usd = cost_per_image * image_count
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    logger.info(
        "Image usage tracked | user=%s | tier=%s | generator=%s | "
        "count=%d | cost=$%.4f (R%.4f)",
        user_id, tier, generator, image_count, total_cost_usd, total_cost_zar
    )
    
    # TODO: In production, write to a 'image_ledger' table
    # await db.execute(
    #     "INSERT INTO image_ledger (user_email, tier, generator, count, "
    #     "cost_usd, cost_zar, timestamp) VALUES (...)"
    # )
    
    return {
        "usd": round(total_cost_usd, 6),
        "zar": round(total_cost_zar, 4),
        "breakdown": {
            "input_tokens": 0,
            "output_tokens": 0,
            "input_cost_usd": 0.0,
            "output_cost_usd": total_cost_usd
        }
    }


def calculate_monthly_cost_estimate(
    tier: str,
    avg_messages_per_day: int,
    avg_input_tokens: int = 200,
    avg_output_tokens: int = 500,
    avg_images_per_month: int = 0
) -> MonthlyEstimate:
    """
    Calculate estimated monthly cost for a user based on tier and usage patterns.
    
    Args:
        tier: User tier: "free", "jive", or "jigga"
        avg_messages_per_day: Average number of messages per day
        avg_input_tokens: Average input tokens per message
        avg_output_tokens: Average output tokens per message
        avg_images_per_month: Average images generated per month
        
    Returns:
        MonthlyEstimate with monthly cost estimates in USD and ZAR
    """
    messages_per_month = avg_messages_per_day * 30
    tier_lower = tier.lower()
    
    # Text costs by tier
    if tier_lower == "jigga":
        input_cost_per_m = settings.COST_JIGGA_INPUT   # $0.40
        output_cost_per_m = settings.COST_JIGGA_OUTPUT  # $0.80
        image_cost = settings.COST_FLUX_IMAGE  # $0.04
    elif tier_lower == "jive":
        input_cost_per_m = settings.COST_JIVE_INPUT   # $0.10
        output_cost_per_m = settings.COST_JIVE_OUTPUT  # $0.10
        image_cost = settings.COST_FLUX_IMAGE  # $0.04
    else:
        input_cost_per_m = settings.COST_FREE_INPUT   # $0.00
        output_cost_per_m = settings.COST_FREE_OUTPUT  # $0.00
        image_cost = settings.COST_LONGCAT_IMAGE  # $0.00
    
    # Calculate text costs
    text_input_cost = (messages_per_month * avg_input_tokens / MILLION) * input_cost_per_m
    text_output_cost = (messages_per_month * avg_output_tokens / MILLION) * output_cost_per_m
    
    # Calculate image costs
    image_total_cost = avg_images_per_month * image_cost
    
    total_usd = text_input_cost + text_output_cost + image_total_cost
    total_zar = total_usd * settings.ZAR_USD_RATE
    
    return {
        "monthly_usd": round(total_usd, 4),
        "monthly_zar": round(total_zar, 2),
        "messages_per_month": messages_per_month,
        "cost_per_message_usd": round((text_input_cost + text_output_cost) / messages_per_month, 6) if messages_per_month > 0 else 0.0
    }
