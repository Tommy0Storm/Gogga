"""
GOGGA Domain Models
Pydantic models for API request/response validation.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ============== Chat Models ==============

class Message(BaseModel):
    """A single message in the conversation."""
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str = Field(..., description="The message content")


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(..., min_length=1, max_length=10000, description="The user's message")
    user_id: str = Field(..., description="Unique user identifier")
    history: Optional[List[Message]] = Field(default=None, description="Previous conversation history")
    force_model: Optional[str] = Field(default=None, description="Force a specific model tier")


class TokenUsage(BaseModel):
    """Token usage statistics."""
    input: int = Field(..., description="Number of input tokens")
    output: int = Field(..., description="Number of output tokens")


class ChatMetadata(BaseModel):
    """Metadata about the chat response."""
    model_used: str = Field(..., description="Model identifier used for inference")
    layer: str = Field(..., description="Either 'speed' or 'complex'")
    latency_seconds: float = Field(..., description="Inference latency in seconds")
    tokens: TokenUsage = Field(..., description="Token usage breakdown")
    cost_usd: float = Field(..., description="Cost in US Dollars")
    cost_zar: float = Field(..., description="Cost in South African Rand")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str = Field(..., description="The AI assistant's response")
    meta: ChatMetadata = Field(..., description="Response metadata")


# ============== User Models ==============

class UserBase(BaseModel):
    """Base user model."""
    email: EmailStr
    name: Optional[str] = None


class UserCreate(UserBase):
    """Model for creating a new user."""
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    """User response model (excludes sensitive data)."""
    id: str
    subscription_tier: str = "free"
    tokens_used: int = 0
    tokens_limit: int = 10000
    created_at: datetime


# ============== Subscription Models ==============

class SubscriptionTier(BaseModel):
    """Subscription tier definition."""
    name: str
    price_zar: float
    tokens_per_month: int
    features: List[str]


class SubscriptionRequest(BaseModel):
    """Request to create a subscription."""
    user_email: EmailStr
    tier: str = Field(..., description="Subscription tier name")


class SubscriptionResponse(BaseModel):
    """Response after subscription creation."""
    payment_url: str
    payment_data: Dict[str, Any]
    signature: str


# ============== Payment Models ==============

class PayFastNotification(BaseModel):
    """PayFast ITN (Instant Transaction Notification) payload."""
    m_payment_id: str
    pf_payment_id: str
    payment_status: str
    item_name: str
    amount_gross: float
    amount_fee: float
    amount_net: float
    email_address: EmailStr
    token: Optional[str] = None  # For subscription management
    billing_date: Optional[str] = None


# ============== Health Check Models ==============

class HealthCheck(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str
    timestamp: datetime


class ServiceStatus(BaseModel):
    """Individual service status."""
    name: str
    status: str
    latency_ms: Optional[float] = None


class DetailedHealthCheck(HealthCheck):
    """Detailed health check with service statuses."""
    services: List[ServiceStatus]
