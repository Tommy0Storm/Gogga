"""
GOGGA Configuration Module
Manages environment variables via Pydantic Settings for type-safe configuration.
Fails fast at startup if critical keys are missing.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )
    
    PROJECT_NAME: str = "GOGGA API"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = Field(
        default=False,
        description="Enable debug mode (allows tier header override - NEVER True in production)"
    )
    
    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    ADMIN_SECRET: str = Field(
        default="admin-secret-change-in-production",
        description="Secret for admin endpoint authentication (set in .env)"
    )
    
    # Cerebras Configuration (Text only)
    CEREBRAS_API_KEY: str = Field(..., description="Cerebras Cloud API Key")
    
    # Serper.dev Configuration (Web Search)
    SERPER_API_KEY: str = Field(
        default="c43da6c8076b9cd7bb1020ca49cb92b895090372",
        description="Serper.dev API Key for Google Search"
    )
    SERPER_RATE_LIMIT: int = Field(default=100, ge=1, le=1000, description="Serper requests per minute")
    
    # CePO Configuration (Cerebras Planning and Optimization)
    # Routes JIVE/JIGGA requests through 4-step planning pipeline + Best of N selection
    CEPO_ENABLED: bool = Field(default=True, description="Enable CePO for JIVE/JIGGA tiers")
    CEPO_BASE_URL: str = Field(default="http://cepo:8080", description="CePO sidecar URL")
    CEPO_TIMEOUT: float = Field(default=120.0, ge=30.0, le=300.0, description="CePO request timeout (seconds)")
    CEPO_BESTOFN_N: int = Field(default=3, ge=1, le=5, description="Best of N sample count")
    
    # SIMPLIFIED MODEL ARCHITECTURE (2025-01):
    # - All tiers use Qwen models (removed Llama)
    # - FREE tier: Qwen 3 235B via OpenRouter (pay-per-token, ~$0.15/M in + $0.45/M out)
    # - JIVE/JIGGA: Qwen 3 32B (default) + Qwen 3 235B (complex queries) via Cerebras
    # - Only difference between tiers: token limits (subscription)
    
    # FREE tier: Qwen 3 235B via OpenRouter (no :free variant exists)
    MODEL_FREE: str = "qwen/qwen3-235b-a22b"
    
    # JIVE tier: Qwen 3 32B (general chat, thinking mode)
    MODEL_JIVE: str = "qwen-3-32b"
    
    # JIGGA tier: Qwen 3 32B (general) + Qwen 3 235B (complex/legal/multilingual)
    MODEL_JIGGA: str = "qwen-3-32b"  # Default for general queries
    MODEL_JIGGA_235B: str = "qwen-3-235b-a22b-instruct-2507"  # Complex/legal queries
    
    # Model Settings (JIGGA Qwen)
    JIGGA_MAX_TOKENS: int = 8000  # Max output tokens for Qwen 3 32B
    
    # Qwen Thinking Mode Settings (all paid tiers now use thinking mode)
    # DO NOT use greedy decoding (temp=0) - causes performance degradation and repetitions
    QWEN_THINKING_TEMPERATURE: float = 0.6
    QWEN_THINKING_TOP_P: float = 0.95
    QWEN_THINKING_TOP_K: int = 20
    QWEN_THINKING_MIN_P: float = 0.0
    
    # Pricing Configuration (USD per Million Tokens)
    # Cerebras official pricing (December 2025) - verified from cerebras.ai/cloud
    # FREE tier: OpenRouter free models - no cost but still track tokens
    COST_FREE_INPUT: float = 0.0
    COST_FREE_OUTPUT: float = 0.0
    
    # JIVE tier: Qwen 3 32B (via Cerebras @ 2,600 t/s)
    # Source: cerebras.ai/cloud pricing page
    COST_JIVE_INPUT: float = 0.40   # $0.40 per M input tokens
    COST_JIVE_OUTPUT: float = 0.80  # $0.80 per M output tokens
    
    # JIGGA tier: Qwen 3 32B (via Cerebras) - same pricing as JIVE
    COST_JIGGA_INPUT: float = 0.40   # $0.40 per M input tokens
    COST_JIGGA_OUTPUT: float = 0.80  # $0.80 per M output tokens
    
    # JIGGA tier 235B: Qwen 3 235B A22B Instruct (via Cerebras @ 1,400 t/s)
    # Routes for: constitutional, legal, litigation, African languages
    COST_JIGGA_235B_INPUT: float = 0.60   # $0.60 per M tokens
    COST_JIGGA_235B_OUTPUT: float = 1.20  # $1.20 per M tokens
    
    # OptiLLM Reasoning Multiplier
    # When OptiLLM enhancements are applied, output tokens increase due to:
    # - Chain-of-thought reflection (adds ~20-40% tokens)
    # - Planning generation (adds ~10-20% tokens)
    # - Re-read context repetition (adds ~5% tokens)
    OPTILLM_BASIC_MULTIPLIER: float = 1.1     # FREE: SPL + Re-Read only
    OPTILLM_STANDARD_MULTIPLIER: float = 1.3  # JIVE: + CoT Reflection  
    OPTILLM_ADVANCED_MULTIPLIER: float = 1.5  # JIGGA: + Planning + Empathy
    
    # Image Generation Pricing
    COST_FLUX_IMAGE: float = 0.04  # $0.04 per FLUX 1.1 Pro image
    COST_LONGCAT_IMAGE: float = 0.0  # FREE tier images (Pollinations)
    
    # Vertex AI Imagen Pricing (USD per image)
    COST_IMAGEN_V3_CREATE: float = 0.04  # $0.04 per Imagen v3 create/edit
    COST_IMAGEN_V4_UPSCALE: float = 0.06  # $0.06 per Imagen v4 Ultra upscale
    
    # Vertex AI Veo Pricing (USD per second)
    COST_VEO_VIDEO_ONLY: float = 0.20  # $0.20 per second video only
    COST_VEO_VIDEO_AUDIO: float = 0.40  # $0.40 per second video + audio
    
    # Media Tier Allowances (monthly limits)
    # FREE tier - preview only
    MEDIA_FREE_IMAGES: int = 1  # 1 preview/day (watermarked)
    MEDIA_FREE_VIDEO_SECONDS: int = 3  # 3-sec sample
    
    # JIVE tier (R49/mo)
    MEDIA_JIVE_IMAGES: int = 50  # 50 images/month
    MEDIA_JIVE_EDITS: int = 20  # 20 edits/month
    MEDIA_JIVE_UPSCALE: int = 20  # 20 upscales/month (v3 only)
    MEDIA_JIVE_VIDEO_MINUTES: int = 5  # 5 minutes/month video only
    MEDIA_JIVE_VIDEO_AUDIO_MINUTES: int = 2  # 2 minutes/month video+audio
    
    # JIGGA tier (R149/mo)
    MEDIA_JIGGA_IMAGES: int = 200  # 200 images/month
    MEDIA_JIGGA_EDITS: int = 100  # 100 edits/month
    MEDIA_JIGGA_UPSCALE: int = 50  # 50 upscales/month (v3+v4)
    MEDIA_JIGGA_VIDEO_MINUTES: int = 20  # 20 minutes/month video only
    MEDIA_JIGGA_VIDEO_AUDIO_MINUTES: int = 10  # 10 minutes/month video+audio
    
    # Vertex AI Configuration
    VERTEX_PROJECT_ID: str = Field(default="general-dev-480621", description="Google Cloud Project ID")
    VERTEX_LOCATION: str = Field(default="us-central1", description="Vertex AI region")
    
    # Vertex AI Model Names (Dec 2025 - from official docs)
    IMAGEN_V3_MODEL: str = "imagen-3.0-generate-002"  # Text-to-image
    IMAGEN_V3_EDIT_MODEL: str = "imagen-3.0-capability-001"  # Edit/inpaint
    IMAGEN_V4_UPSCALE_MODEL: str = "imagen-4.0-upscale-preview"  # Upscale to 2K/3K/4K
    VEO_MODEL: str = "veo-3.1-generate-001"  # Video generation
    VEO_FAST_MODEL: str = "veo-3.1-fast-generate-001"  # Faster video generation
    
    # Gemini Models (via google-genai SDK with Vertex AI)
    GEMINI_FLASH_MODEL: str = "gemini-2.5-flash"  # Fast, cost-effective
    GEMINI_PRO_MODEL: str = "gemini-2.5-pro"  # Advanced reasoning
    
    # Gemini Thinking Configuration (token budgets per tier)
    # Higher budget = more reasoning tokens = better quality but slower
    GEMINI_THINKING_BUDGET_FREE: int = 0  # Disabled for free tier
    GEMINI_THINKING_BUDGET_JIVE: int = 4096  # Balanced reasoning
    GEMINI_THINKING_BUDGET_JIGGA: int = 8192  # Deep reasoning
    
    # Gemini Pricing (USD per Million Tokens) - Dec 2025
    COST_GEMINI_FLASH_INPUT: float = 0.075  # $0.075 per M input tokens
    COST_GEMINI_FLASH_OUTPUT: float = 0.30  # $0.30 per M output tokens
    COST_GEMINI_PRO_INPUT: float = 1.25  # $1.25 per M input tokens
    COST_GEMINI_PRO_OUTPUT: float = 10.0  # $10.00 per M output tokens
    
    # Exchange Rate (ZAR/USD) - December 2025
    ZAR_USD_RATE: float = Field(default=19.0, ge=1.0, le=100.0)  # R19 per $1 USD
    
    # ============================================
    # SUBSCRIPTION TIER LIMITS (Monthly)
    # Verified pricing achieves 47% margin on both tiers
    # ============================================
    
    # JIVE tier (R99/month = $5.21 USD)
    TIER_JIVE_PRICE_ZAR: int = 99
    TIER_JIVE_CHAT_TOKENS: int = 500_000      # Cost: $0.30 (Qwen 32B)
    TIER_JIVE_IMAGES: int = 20                 # Cost: $0.80 (create only)
    TIER_JIVE_IMAGE_EDITS: int = 0             # Not included
    TIER_JIVE_UPSCALES: int = 0                # Not included  
    TIER_JIVE_VIDEO_SECONDS: int = 5           # Cost: $1.00 (1 short video)
    TIER_JIVE_GOGGA_TALK_MINS: float = 30      # Cost: $0.68
    # Total JIVE cost: $2.78 → 47% margin
    
    # JIGGA tier (R299/month = $15.74 USD)
    TIER_JIGGA_PRICE_ZAR: int = 299
    TIER_JIGGA_CHAT_TOKENS: int = 2_000_000    # Cost: $1.20 (32B + 235B routing)
    TIER_JIGGA_IMAGES: int = 70                 # Cost: $2.80
    TIER_JIGGA_IMAGE_EDITS: int = 30            # Cost: $1.20 
    TIER_JIGGA_UPSCALES: int = 10               # Cost: $0.60
    TIER_JIGGA_VIDEO_SECONDS: int = 16          # Cost: $3.20 (2 videos)
    TIER_JIGGA_GOGGA_TALK_MINS: float = 25      # Cost: $0.56
    # Total JIGGA cost: $8.36 → 47% margin
    
    # Icon Generation (Gemini 2.0 Flash - Premium Feature)
    # Pricing: ~$0.10/1M tokens (experimental rate)
    # Avg icon: ~3000 tokens = $0.0003 USD = R0.006 ZAR
    # Cost analysis: 99.7% gross margin at current pricing
    TIER_FREE_ICONS: int = 3                    # FREE: 3 watermarked previews/month
    TIER_JIVE_ICONS: int = 10                   # JIVE: 10 icons/month (R10/icon)
    TIER_JIGGA_ICONS: int = 30                  # JIGGA: 30 icons/month (R5/icon)
    CREDIT_COST_ICON: int = 5                   # 5 credits per icon (R9.50 pay-as-you-go)
    COST_ICON_PER_1K_TOKENS: float = 0.0001     # Gemini 2.0 Flash experimental
    
    # SA-Themed Style Templates (Premium Differentiation)
    # Apply with: prompt + ". Style: " + SA_STYLE_TEMPLATES[template]
    SA_STYLE_TEMPLATES: dict = {
        "ubuntu": "Warm earthy tones (ochre, terracotta, sage), circular harmonious shapes, community-focused composition, soft shadows, African philosophy of interconnectedness",
        "kente": "Bold geometric patterns, vibrant Ghanaian-inspired colors (red, gold, green, black), woven textile texture, regal symmetry, West African royalty aesthetic",
        "ndebele": "Bright primary colors (blue, red, yellow, green, white), linear geometric patterns, architectural precision, tribal wall art motifs, bold black outlines",
        "township": "Graffiti-inspired street art style, vibrant Soweto murals aesthetic, spray paint texture, bold outlines, social commentary undertones, urban energy",
        "protea": "National flower motifs, organic petal curves, soft gradients (pink to cream), natural South African elegance, botanical heritage symbolism",
        "beadwork": "Intricate Zulu patterns, glossy glass bead texture, traditional color schemes (red, white, black, blue), handcrafted artisan feel, cultural storytelling",
        "shweshwe": "Indigo blue base with white geometric print patterns, fabric texture with three-dimensional folds, traditional South African textile design",
        "madiba": "Nelson Mandela tribute style, rainbow nation colors (all 11 official languages), unity symbolism, iconic hand gestures, legacy of reconciliation",
    }
    
    # ============================================
    # CREDIT PACK DEFINITIONS
    # 1 credit = $0.10 USD = R1.90 ZAR
    # ============================================
    
    CREDIT_VALUE_USD: float = 0.10  # Each credit worth $0.10
    
    # JIVE Credit Packs (restricted to: chat, image_create, gogga_talk)
    CREDIT_PACK_JIVE_STARTER: int = 50       # 50 credits for R49
    CREDIT_PACK_JIVE_STANDARD: int = 100     # 100 credits for R89
    CREDIT_PACK_JIVE_PLUS: int = 175         # 175 credits for R129 (+17% bonus)
    
    # JIGGA Credit Packs (no restrictions - all features)
    CREDIT_PACK_JIGGA_PRO: int = 150         # 150 credits for R149
    CREDIT_PACK_JIGGA_BUSINESS: int = 320    # 320 credits for R279 (+7% bonus)
    CREDIT_PACK_JIGGA_ENTERPRISE: int = 700  # 700 credits for R549 (+17% bonus)
    
    # Credit costs per action (in credits)
    CREDIT_COST_10K_TOKENS: int = 1          # 1 credit per 10K tokens
    CREDIT_COST_IMAGE_CREATE: int = 1        # 1 credit per image
    CREDIT_COST_IMAGE_EDIT: int = 1          # 1 credit per edit
    CREDIT_COST_UPSCALE: int = 1             # 1 credit per upscale
    CREDIT_COST_VIDEO_SECOND: int = 2        # 2 credits per second
    CREDIT_COST_GOGGA_TALK_MIN: int = 1      # 1 credit per minute
    CREDIT_COST_ICON: int = 5                # 5 credits per icon (premium)
    
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
    
    # DeepInfra - Image Generation (FLUX 1.1 Pro)
    DEEPINFRA_API_KEY: str = Field(default="", description="DeepInfra API Key for image generation")
    DEEPINFRA_IMAGE_MODEL: str = Field(default="black-forest-labs/FLUX-1.1-pro")
    
    # OpenRouter - Free tier text + Image Prompt Enhancement
    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key for FREE tier and prompt enhancement")
    OPENROUTER_MODEL_QWEN: str = Field(default="qwen/qwen3-coder:free")  # FREE tier text (262k context)
    OPENROUTER_MODEL_LONGCAT: str = Field(default="openai/gpt-oss-20b:free")  # Updated to valid free model
    
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


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
