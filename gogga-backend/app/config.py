"""
GOGGA Configuration Module
Manages environment variables via Pydantic Settings for type-safe configuration.
Fails fast at startup if critical keys are missing.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    PROJECT_NAME: str = "GOGGA API"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Cerebras Configuration (Text only)
    CEREBRAS_API_KEY: str = Field(..., description="Cerebras Cloud API Key")
    
    # Model Identification (Cerebras)
    # JIVE tier: Llama 3.3 70B via CePO at ~2,200 tokens/s
    # JIGGA tier: Qwen 3 32B (fast/general) + Qwen 3 235B (thinking/complex/African languages)
    MODEL_SPEED: str = "llama3.3-70b"  # JIVE tier (was llama3.1-8b, now unified)
    MODEL_COMPLEX: str = "qwen-3-32b"  # JIGGA tier - Qwen 3 32B (cost-effective, general chat)
    MODEL_COMPLEX_235B: str = "qwen-3-235b-a22b-instruct-2507"  # JIGGA tier - Qwen 3 235B (thinking, African languages)
    MODEL_CEPO: str = "llama3.3-70b"  # JIVE reasoning model (same as MODEL_SPEED)
    
    # Model Settings (JIGGA Qwen)
    JIGGA_MAX_TOKENS: int = 8000  # Max output tokens for Qwen 3 32B
    
    # Qwen Thinking Mode Settings (enable_thinking=True)
    # DO NOT use greedy decoding (temp=0) - causes performance degradation and repetitions
    QWEN_THINKING_TEMPERATURE: float = 0.6
    QWEN_THINKING_TOP_P: float = 0.95
    QWEN_THINKING_TOP_K: int = 20
    QWEN_THINKING_MIN_P: float = 0.0
    
    # Qwen Non-Thinking Mode Settings (enable_thinking=False)
    QWEN_FAST_TEMPERATURE: float = 0.7
    QWEN_FAST_TOP_P: float = 0.8
    QWEN_FAST_TOP_K: int = 20
    QWEN_FAST_MIN_P: float = 0.0
    
    # Pricing Configuration (USD per Million Tokens)
    # FREE tier: OpenRouter free models - no cost but still track tokens
    COST_FREE_INPUT: float = 0.0
    COST_FREE_OUTPUT: float = 0.0
    
    # JIVE tier: Llama 3.3 70B (via Cerebras)
    COST_JIVE_INPUT: float = 0.10   # $0.10 per M tokens
    COST_JIVE_OUTPUT: float = 0.10  # $0.10 per M tokens
    
    # JIGGA tier: Qwen 3 32B (via Cerebras)
    COST_JIGGA_INPUT: float = 0.40   # $0.40 per M tokens
    COST_JIGGA_OUTPUT: float = 0.80  # $0.80 per M tokens
    
    # JIGGA tier 235B: Qwen 3 235B Instruct (via Cerebras)
    COST_JIGGA_235B_INPUT: float = 0.60   # $0.60 per M tokens
    COST_JIGGA_235B_OUTPUT: float = 1.20  # $1.20 per M tokens
    
    # Legacy pricing (kept for backwards compatibility)
    COST_SPEED_INPUT: float = 0.10
    COST_SPEED_OUTPUT: float = 0.10
    COST_COMPLEX_INPUT: float = 0.40
    COST_COMPLEX_OUTPUT: float = 0.80
    
    # Image Generation Pricing
    COST_FLUX_IMAGE: float = 0.04  # $0.04 per FLUX 1.1 Pro image
    COST_LONGCAT_IMAGE: float = 0.0  # FREE tier images
    
    # Exchange Rate
    ZAR_USD_RATE: float = Field(default=18.50, ge=1.0, le=100.0)
    
    # PayFast Configuration (Sandbox credentials by default)
    PAYFAST_MERCHANT_ID: str = Field(default="10043379")
    PAYFAST_MERCHANT_KEY: str = Field(default="cv55nate9wgnf")
    PAYFAST_PASSPHRASE: str = Field(default="gogga-testing")
    PAYFAST_ENV: Literal["sandbox", "production"] = "sandbox"
    
    # Application URLs
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = Field(default="http://localhost:3000", description="Frontend URL for internal API calls")
    
    # Internal API Key (for scheduler to call frontend internal APIs)
    INTERNAL_API_KEY: str = Field(default="dev-internal-key-change-in-production")
    
    # CePO (Cerebras Planning Optimization) - OptiLLM sidecar
    # In Docker: http://cepo:8080, locally: http://localhost:8080
    CEPO_URL: str = Field(default="http://localhost:8080")
    CEPO_ENABLED: bool = Field(default=True)
    
    # DeepInfra - Image Generation (FLUX 1.1 Pro)
    DEEPINFRA_API_KEY: str = Field(default="", description="DeepInfra API Key for image generation")
    DEEPINFRA_IMAGE_MODEL: str = Field(default="black-forest-labs/FLUX-1.1-pro")
    
    # OpenRouter - Free Image Prompt Enhancement (Llama 3.3 70B + LongCat)
    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key for prompt enhancement")
    OPENROUTER_MODEL_LLAMA: str = Field(default="meta-llama/llama-3.3-70b-instruct:free")
    OPENROUTER_MODEL_LONGCAT: str = Field(default="meituan/longcat-flash-chat:free")
    
    # PostHog Analytics (EU region)
    POSTHOG_API_KEY: str = Field(default="", description="PostHog API Key for analytics")
    POSTHOG_HOST: str = Field(default="https://eu.i.posthog.com")
    
    # Database
    DATABASE_URL: str = Field(default="sqlite:///./gogga.db")
    
    @field_validator("CEREBRAS_API_KEY")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """Ensure API key is not empty."""
        if not v or v.strip() == "":
            raise ValueError("CEREBRAS_API_KEY cannot be empty")
        return v.strip()
    
    @field_validator("PAYFAST_ENV")
    @classmethod
    def validate_payfast_env(cls, v: str) -> str:
        """Ensure PayFast environment is valid."""
        if v not in ("sandbox", "production"):
            raise ValueError("PAYFAST_ENV must be 'sandbox' or 'production'")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Ignore extra environment variables  # Ignore extra environment variables


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
