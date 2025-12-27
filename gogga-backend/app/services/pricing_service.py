"""
GOGGA Dynamic Pricing Service

Loads pricing from the admin database via API and caches it.
Falls back to config.py static values if API is unavailable.

Usage:
    from app.services.pricing_service import get_model_pricing, get_exchange_rate
    
    pricing = await get_model_pricing("qwen-3-32b")
    zar_rate = await get_exchange_rate("USD", "ZAR")
"""
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import httpx

import os

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ModelPricingData:
    """Model pricing data from database."""
    model_id: str
    display_name: str
    provider: str
    input_price_per_m: float  # USD per million tokens
    output_price_per_m: float  # USD per million tokens
    image_price_per_unit: float  # USD per image
    allowed_tiers: list[str]
    is_active: bool


@dataclass
class FeatureCostData:
    """Feature cost data from database."""
    feature_id: str
    display_name: str
    cost_per_use: float  # USD per use
    allowed_tiers: list[str]
    is_active: bool


@dataclass
class PricingCache:
    """Cached pricing data with TTL."""
    models: dict[str, ModelPricingData]
    features: dict[str, FeatureCostData]
    exchange_rate: float  # USD to ZAR
    loaded_at: datetime
    ttl_seconds: int = 300  # 5 minute cache
    
    def is_valid(self) -> bool:
        """Check if cache is still valid."""
        return datetime.now() - self.loaded_at < timedelta(seconds=self.ttl_seconds)


# Global pricing cache
_pricing_cache: Optional[PricingCache] = None
_cache_lock = asyncio.Lock()


# Default fallback pricing (matches config.py)
DEFAULT_MODEL_PRICING: dict[str, ModelPricingData] = {
    "qwen-3-32b": ModelPricingData(
        model_id="qwen-3-32b",
        display_name="Qwen 3 32B",
        provider="cerebras",
        input_price_per_m=settings.COST_JIVE_INPUT,
        output_price_per_m=settings.COST_JIVE_OUTPUT,
        image_price_per_unit=0.0,
        allowed_tiers=["jive", "jigga"],
        is_active=True,
    ),
    "qwen-3-235b-a22b-instruct-2507": ModelPricingData(
        model_id="qwen-3-235b-a22b-instruct-2507",
        display_name="Qwen 3 235B A22B",
        provider="openrouter",
        input_price_per_m=settings.COST_JIGGA_235B_INPUT,
        output_price_per_m=settings.COST_JIGGA_235B_OUTPUT,
        image_price_per_unit=0.0,
        allowed_tiers=["jigga"],
        is_active=True,
    ),
    "qwen/qwen3-235b-a22b": ModelPricingData(
        model_id="qwen/qwen3-235b-a22b",
        display_name="Qwen 3 235B (OpenRouter)",
        provider="openrouter",
        input_price_per_m=0.15,  # ~$0.15/M input
        output_price_per_m=0.45,  # ~$0.45/M output
        image_price_per_unit=0.0,
        allowed_tiers=["free"],
        is_active=True,
    ),
}

DEFAULT_EXCHANGE_RATE = settings.ZAR_USD_RATE


async def _fetch_pricing_from_api() -> Optional[PricingCache]:
    """Fetch pricing data from the admin API."""
    try:
        # Disable SSL verification for dev (self-signed certs) or HTTPS URLs
        verify = not (os.getenv("DEBUG") or settings.FRONTEND_URL.startswith("https://192.168"))
        async with httpx.AsyncClient(timeout=10.0, verify=verify) as client:
            base_url = settings.FRONTEND_URL.rstrip("/")
            
            # Fetch models, features, and exchange rates in parallel
            models_task = client.get(f"{base_url}/api/tokens/models")
            features_task = client.get(f"{base_url}/api/tokens/features")
            exchange_task = client.get(f"{base_url}/api/tokens/exchange")
            
            models_res, features_res, exchange_res = await asyncio.gather(
                models_task, features_task, exchange_task,
                return_exceptions=True
            )
            
            models: dict[str, ModelPricingData] = {}
            features: dict[str, FeatureCostData] = {}
            exchange_rate = DEFAULT_EXCHANGE_RATE
            
            # Parse models
            if isinstance(models_res, httpx.Response) and models_res.status_code == 200:
                data = models_res.json()
                for m in data.get("models", []):
                    models[m["modelId"]] = ModelPricingData(
                        model_id=m["modelId"],
                        display_name=m["displayName"],
                        provider=m["provider"],
                        input_price_per_m=m["inputPricePerM"],
                        output_price_per_m=m["outputPricePerM"],
                        image_price_per_unit=m.get("imagePricePerUnit", 0.0),
                        allowed_tiers=m["allowedTiers"].split(","),
                        is_active=m["isActive"],
                    )
            else:
                logger.warning(f"Failed to fetch model pricing: {models_res}")
            
            # Parse features
            if isinstance(features_res, httpx.Response) and features_res.status_code == 200:
                data = features_res.json()
                for f in data.get("features", []):
                    features[f["featureKey"]] = FeatureCostData(
                        feature_id=f["featureKey"],
                        display_name=f["displayName"],
                        cost_per_use=f.get("costAmountUSD", 0.0),
                        allowed_tiers=list(f.get("tierOverrides", {}).keys()) if isinstance(f.get("tierOverrides"), dict) else ["free", "jive", "jigga"],
                        is_active=f.get("isBillable", True),
                    )
            else:
                logger.warning(f"Failed to fetch feature costs: {features_res}")
            
            # Parse exchange rate
            if isinstance(exchange_res, httpx.Response) and exchange_res.status_code == 200:
                data = exchange_res.json()
                for r in data.get("rates", []):
                    if r["fromCurrency"] == "USD" and r["toCurrency"] == "ZAR":
                        exchange_rate = r["rate"]
                        break
            else:
                logger.warning(f"Failed to fetch exchange rates: {exchange_res}")
            
            # Only create cache if we got at least models
            if models:
                return PricingCache(
                    models=models,
                    features=features,
                    exchange_rate=exchange_rate,
                    loaded_at=datetime.now(),
                )
            
            return None
            
    except Exception as e:
        logger.error(f"Error fetching pricing from API: {e}")
        return None


async def _get_cache() -> PricingCache:
    """Get pricing cache, refreshing if needed."""
    global _pricing_cache
    
    async with _cache_lock:
        if _pricing_cache is None or not _pricing_cache.is_valid():
            logger.info("Refreshing pricing cache...")
            new_cache = await _fetch_pricing_from_api()
            
            if new_cache:
                _pricing_cache = new_cache
                logger.info(f"Pricing cache refreshed: {len(new_cache.models)} models, {len(new_cache.features)} features")
            elif _pricing_cache is None:
                # First load failed, use defaults
                logger.warning("Using default pricing (API unavailable)")
                _pricing_cache = PricingCache(
                    models=DEFAULT_MODEL_PRICING.copy(),
                    features={},
                    exchange_rate=DEFAULT_EXCHANGE_RATE,
                    loaded_at=datetime.now(),
                    ttl_seconds=60,  # Retry sooner when using defaults
                )
            else:
                # Refresh failed but we have stale cache, extend TTL
                logger.warning("Extending stale pricing cache (refresh failed)")
                _pricing_cache.loaded_at = datetime.now()
                _pricing_cache.ttl_seconds = 60  # Retry sooner
        
        return _pricing_cache


async def get_model_pricing(model_id: str) -> Optional[ModelPricingData]:
    """Get pricing for a specific model."""
    cache = await _get_cache()
    return cache.models.get(model_id)


async def get_model_pricing_by_tier(tier: str) -> list[ModelPricingData]:
    """Get all active models available for a tier."""
    cache = await _get_cache()
    return [
        m for m in cache.models.values()
        if m.is_active and tier.lower() in m.allowed_tiers
    ]


async def get_feature_cost(feature_id: str) -> Optional[FeatureCostData]:
    """Get cost for a specific feature."""
    cache = await _get_cache()
    return cache.features.get(feature_id)


async def get_exchange_rate(from_currency: str = "USD", to_currency: str = "ZAR") -> float:
    """Get exchange rate. Currently only supports USD->ZAR."""
    if from_currency == "USD" and to_currency == "ZAR":
        cache = await _get_cache()
        return cache.exchange_rate
    elif from_currency == "ZAR" and to_currency == "USD":
        cache = await _get_cache()
        return 1.0 / cache.exchange_rate
    else:
        logger.warning(f"Unsupported exchange rate: {from_currency} -> {to_currency}")
        return 1.0


async def get_all_pricing() -> PricingCache:
    """Get all cached pricing data."""
    return await _get_cache()


async def invalidate_cache() -> None:
    """Force cache invalidation (call when pricing is updated)."""
    global _pricing_cache
    async with _cache_lock:
        _pricing_cache = None
    logger.info("Pricing cache invalidated")


def calculate_cost_usd(
    input_tokens: int,
    output_tokens: int,
    model_pricing: ModelPricingData,
    optillm_multiplier: float = 1.0,
) -> float:
    """Calculate cost in USD for a request."""
    input_cost = (input_tokens / 1_000_000) * model_pricing.input_price_per_m
    # Apply OptiLLM multiplier to output tokens
    adjusted_output = output_tokens * optillm_multiplier
    output_cost = (adjusted_output / 1_000_000) * model_pricing.output_price_per_m
    return input_cost + output_cost


async def calculate_cost_zar(
    input_tokens: int,
    output_tokens: int,
    model_pricing: ModelPricingData,
    optillm_multiplier: float = 1.0,
) -> float:
    """Calculate cost in ZAR for a request."""
    usd_cost = calculate_cost_usd(input_tokens, output_tokens, model_pricing, optillm_multiplier)
    zar_rate = await get_exchange_rate("USD", "ZAR")
    return usd_cost * zar_rate
