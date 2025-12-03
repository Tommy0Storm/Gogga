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
    
    # Cerebras Configuration
    CEREBRAS_API_KEY: str = Field(..., description="Cerebras Cloud API Key")
    
    # Model Identification
    MODEL_SPEED: str = "llama3.1-8b"
    MODEL_COMPLEX: str = "qwen-3-235b-a22b-instruct-2507"
    
    # Pricing Configuration (USD per Million Tokens)
    COST_SPEED_INPUT: float = 0.10
    COST_SPEED_OUTPUT: float = 0.10
    COST_COMPLEX_INPUT: float = 0.60
    COST_COMPLEX_OUTPUT: float = 1.20
    
    # Exchange Rate
    ZAR_USD_RATE: float = Field(default=18.50, ge=1.0, le=100.0)
    
    # PayFast Configuration
    PAYFAST_MERCHANT_ID: str = Field(default="10000100")
    PAYFAST_MERCHANT_KEY: str = Field(default="46f0cd694581a")
    PAYFAST_PASSPHRASE: str = Field(default="passphrase")
    PAYFAST_ENV: Literal["sandbox", "production"] = "sandbox"
    
    # Application URLs
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    
    # CePO (Cerebras Planning Optimization) - OptiLLM sidecar
    # In Docker: http://cepo:8080, locally: http://localhost:8080
    CEPO_URL: str = Field(default="http://localhost:8080")
    CEPO_ENABLED: bool = Field(default=True)
    
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
        extra = "ignore"  # Ignore extra environment variables


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
