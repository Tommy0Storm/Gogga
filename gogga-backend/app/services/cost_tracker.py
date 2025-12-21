"""
GOGGA Cost Tracker
Calculates precise token costs based on model pricing tiers.
Essential for unit economics analysis and subscription viability.

Now persists usage to SQLite via frontend API for billing/analytics.
"""
import logging
import ssl
from typing import TypedDict, Final
import httpx

from app.config import settings


logger = logging.getLogger(__name__)

# Constants
MILLION: Final[int] = 1_000_000
FRONTEND_URL: Final[str] = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"

# Create SSL context that doesn't verify certs (for self-signed Docker certs)
_ssl_context = ssl.create_default_context()
_ssl_context.check_hostname = False
_ssl_context.verify_mode = ssl.CERT_NONE


def _get_provider(model: str, layer: str) -> str:
    """Determine the provider based on model and layer."""
    model_lower = model.lower()
    layer_lower = layer.lower()
    
    if "openrouter" in layer_lower or "free" in layer_lower:
        return "openrouter"
    elif "cerebras" in model_lower or "llama" in model_lower or "qwen" in model_lower:
        return "cerebras"
    else:
        return "unknown"


class CostBreakdown(TypedDict):
    """Detailed cost breakdown."""
    input_tokens: int
    output_tokens: int
    adjusted_output_tokens: int
    reasoning_tokens: int
    optillm_multiplier: float
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
    tier: str = "free",
    optillm_level: str = "none",
    reasoning_tokens: int = 0,
) -> UsageCost:
    """
    Calculates the cost of an interaction based on tier and model pricing.
    
    Pricing tiers (USD per Million Tokens) - Cerebras Dec 2025:
    - FREE tier: $0.00 (still tracked for usage limits)
    - JIVE tier (Qwen 3 32B): $0.10 input, $0.10 output
    - JIGGA tier (Qwen 3 32B): $0.10 input, $0.10 output
    - JIGGA 235B (OpenRouter): $0.80 input, $1.10 output
    
    Args:
        user_id: The user's unique identifier (email-based)
        model: The model ID used for inference
        layer: The cognitive layer used
        input_tokens: Number of input tokens consumed
        output_tokens: Number of output tokens generated
        tier: User tier: "free", "jive", or "jigga"
        optillm_level: OptiLLM enhancement level ("none", "basic", "standard", "advanced")
        reasoning_tokens: Separate reasoning token count (for future use)
        
    Returns:
        UsageCost containing cost in USD, ZAR, and breakdown
    """
    # Determine Pricing by Tier
    tier_lower = tier.lower()
    
    if tier_lower == "jigga":
        # Check if using 235B model (multilingual) or 32B (default)
        if "235b" in model.lower() or layer == "jigga_multilingual":
            # JIGGA 235B: Qwen 3 235B Instruct pricing (OpenRouter)
            input_cost_per_m = settings.COST_JIGGA_235B_INPUT   # $0.80
            output_cost_per_m = settings.COST_JIGGA_235B_OUTPUT  # $1.10
        else:
            # JIGGA 32B: Qwen 3 32B pricing (Cerebras)
            input_cost_per_m = settings.COST_JIGGA_INPUT   # $0.10
            output_cost_per_m = settings.COST_JIGGA_OUTPUT  # $0.10
    elif tier_lower == "jive":
        # JIVE: Qwen 3 32B pricing (Cerebras)
        input_cost_per_m = settings.COST_JIVE_INPUT   # $0.10
        output_cost_per_m = settings.COST_JIVE_OUTPUT  # $0.10
    else:
        # FREE: No cost but still track tokens
        input_cost_per_m = settings.COST_FREE_INPUT   # $0.00
        output_cost_per_m = settings.COST_FREE_OUTPUT  # $0.00
    
    # Apply OptiLLM multiplier to output tokens (reasoning overhead)
    # This accounts for additional tokens generated during CoT, planning, etc.
    optillm_multiplier = 1.0
    if optillm_level == "basic":
        optillm_multiplier = settings.OPTILLM_BASIC_MULTIPLIER  # 1.1
    elif optillm_level == "standard":
        optillm_multiplier = settings.OPTILLM_STANDARD_MULTIPLIER  # 1.3
    elif optillm_level == "advanced":
        optillm_multiplier = settings.OPTILLM_ADVANCED_MULTIPLIER  # 1.5
    
    # Adjusted output tokens for cost calculation
    adjusted_output_tokens = int(output_tokens * optillm_multiplier)
    
    # Calculate Cost (Input + Adjusted Output)
    input_cost = (input_tokens / MILLION) * input_cost_per_m
    output_cost = (adjusted_output_tokens / MILLION) * output_cost_per_m
    total_cost_usd = input_cost + output_cost
    
    # Convert to ZAR for local reporting
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    # Log the usage (include OptiLLM overhead if applied)
    log_msg = (
        f"Usage tracked | user={user_id} | tier={tier} | model={model} | layer={layer} | "
        f"input={input_tokens} | output={output_tokens}"
    )
    if optillm_multiplier > 1.0:
        log_msg += f" | optillm={optillm_level}({optillm_multiplier}x) | adjusted_output={adjusted_output_tokens}"
    log_msg += f" | cost=${total_cost_usd:.6f} (R{total_cost_zar:.4f})"
    logger.info(log_msg)
    
    # Persist to SQLite via frontend API
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=_ssl_context) as client:
            await client.post(
                f"{FRONTEND_URL}/api/usage/log",
                json={
                    "userId": user_id,
                    "promptTokens": input_tokens,
                    "completionTokens": output_tokens,
                    "adjustedCompletionTokens": adjusted_output_tokens,
                    "reasoningTokens": reasoning_tokens,
                    "totalTokens": input_tokens + output_tokens,
                    "model": model,
                    "provider": _get_provider(model, layer),
                    "endpoint": "chat",
                    "tier": tier.upper(),
                    "optillmLevel": optillm_level,
                    "optillmMultiplier": optillm_multiplier,
                }
            )
    except Exception as e:
        # Don't fail the request if usage logging fails
        logger.warning("Failed to persist usage to database: %s", e)
    
    return {
        "usd": round(total_cost_usd, 8),
        "zar": round(total_cost_zar, 6),
        "breakdown": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "adjusted_output_tokens": adjusted_output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "optillm_multiplier": optillm_multiplier,
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
    - JIVE/JIGGA tier GOGGA Pro (Imagen 3.0): $0.04 per image
    
    Args:
        user_id: The user's unique identifier (email-based)
        tier: User tier: "free", "jive", or "jigga"
        generator: Image generator used: "pollinations", "imagen", or legacy "flux"
        image_count: Number of images generated
        
    Returns:
        UsageCost containing cost in USD and ZAR
    """
    tier_lower = tier.lower()
    
    # Determine cost per image
    # Pollinations.ai is free
    generator_lower = generator.lower()
    if tier_lower == "free" or generator_lower in ("pollinations", "pollinations+horde"):
        cost_per_image = settings.COST_LONGCAT_IMAGE  # $0.00
    else:
        # Imagen or any premium generator
        cost_per_image = settings.COST_IMAGEN_V3_CREATE  # $0.04
    
    total_cost_usd = cost_per_image * image_count
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    logger.info(
        "Image usage tracked | user=%s | tier=%s | generator=%s | "
        "count=%d | cost=$%.4f (R%.4f)",
        user_id, tier, generator, image_count, total_cost_usd, total_cost_zar
    )
    
    # Persist to SQLite via frontend API
    try:
        # Convert USD cost to ZAR cents for storage
        cost_zar_cents = int(total_cost_zar * 100)
        
        async with httpx.AsyncClient(timeout=5.0, verify=_ssl_context) as client:
            await client.post(
                f"{FRONTEND_URL}/api/usage/log",
                json={
                    "userId": user_id,
                    "promptTokens": 0,
                    "completionTokens": 0,
                    "totalTokens": 0,
                    "costCents": cost_zar_cents,
                    "model": generator,
                    "provider": generator,
                    "endpoint": "images",
                    "tier": tier.upper(),
                }
            )
    except Exception as e:
        # Don't fail the request if usage logging fails
        logger.warning("Failed to persist image usage to database: %s", e)
    
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


async def track_imagen_usage(
    user_id: str,
    tier: str,
    operation: str,
    image_count: int = 1
) -> UsageCost:
    """
    Track Vertex AI Imagen usage and cost.
    
    Pricing:
    - Imagen v3 create/edit: $0.04 per image
    - Imagen v4 upscale: $0.06 per image
    
    Args:
        user_id: User identifier
        tier: User tier
        operation: "create", "edit", or "upscale"
        image_count: Number of images
        
    Returns:
        UsageCost containing cost in USD and ZAR
    """
    if operation == "upscale":
        cost_per_image = settings.COST_IMAGEN_V4_UPSCALE
    else:
        cost_per_image = settings.COST_IMAGEN_V3_CREATE
    
    total_cost_usd = cost_per_image * image_count
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    logger.info(
        "Imagen usage tracked | user=%s | tier=%s | op=%s | "
        "count=%d | cost=$%.4f (R%.4f)",
        user_id, tier, operation, image_count, total_cost_usd, total_cost_zar
    )
    
    # Persist to SQLite via frontend API
    try:
        cost_zar_cents = int(total_cost_zar * 100)
        
        async with httpx.AsyncClient(timeout=5.0, verify=_ssl_context) as client:
            await client.post(
                f"{FRONTEND_URL}/api/usage/log",
                json={
                    "userId": user_id,
                    "promptTokens": 0,
                    "completionTokens": 0,
                    "totalTokens": 0,
                    "costCents": cost_zar_cents,
                    "model": f"imagen-{operation}",
                    "provider": "vertex-ai",
                    "endpoint": "media/images",
                    "tier": tier.upper(),
                }
            )
    except Exception as e:
        logger.warning("Failed to persist Imagen usage: %s", e)
    
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


async def track_veo_usage(
    user_id: str,
    tier: str,
    duration_seconds: int,
    with_audio: bool = False
) -> UsageCost:
    """
    Track Vertex AI Veo video usage and cost.
    
    Pricing:
    - Video only: $0.20 per second
    - Video + audio: $0.40 per second
    
    Args:
        user_id: User identifier
        tier: User tier
        duration_seconds: Video duration in seconds
        with_audio: Whether audio was generated
        
    Returns:
        UsageCost containing cost in USD and ZAR
    """
    if with_audio:
        cost_per_second = settings.COST_VEO_VIDEO_AUDIO
    else:
        cost_per_second = settings.COST_VEO_VIDEO_ONLY
    
    total_cost_usd = cost_per_second * duration_seconds
    total_cost_zar = total_cost_usd * settings.ZAR_USD_RATE
    
    logger.info(
        "Veo usage tracked | user=%s | tier=%s | duration=%ds | "
        "audio=%s | cost=$%.4f (R%.4f)",
        user_id, tier, duration_seconds, with_audio, total_cost_usd, total_cost_zar
    )
    
    # Persist to SQLite via frontend API
    try:
        cost_zar_cents = int(total_cost_zar * 100)
        
        async with httpx.AsyncClient(timeout=5.0, verify=_ssl_context) as client:
            await client.post(
                f"{FRONTEND_URL}/api/usage/log",
                json={
                    "userId": user_id,
                    "promptTokens": 0,
                    "completionTokens": 0,
                    "totalTokens": 0,
                    "costCents": cost_zar_cents,
                    "model": f"veo-{'audio' if with_audio else 'video'}",
                    "provider": "vertex-ai",
                    "endpoint": "media/videos",
                    "tier": tier.upper(),
                    "metadata": {
                        "duration_seconds": duration_seconds,
                        "with_audio": with_audio
                    }
                }
            )
    except Exception as e:
        logger.warning("Failed to persist Veo usage: %s", e)
    
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
