"""
GOGGA Domain Models
Pydantic models for API request/response validation.
"""
from enum import Enum
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
    tier: str = Field(default="free", description="User tier: free, jive, or jigga")
    layer: str = Field(..., description="Cognitive layer used")
    model: str = Field(default="", description="Model identifier used")
    provider: str = Field(default="", description="Provider: openrouter, cerebras, deepinfra")
    latency_seconds: float = Field(..., description="Inference latency in seconds")
    tokens: Optional[Dict[str, int]] = Field(default=None, description="Token usage")
    cost_usd: Optional[float] = Field(default=0.0, description="Cost in US Dollars")
    cost_zar: Optional[float] = Field(default=0.0, description="Cost in South African Rand")
    thinking_mode: Optional[bool] = Field(default=None, description="JIGGA thinking mode")
    no_think: Optional[bool] = Field(default=None, description="JIGGA /no_think appended")
    has_thinking: Optional[bool] = Field(default=False, description="Response contains thinking block")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str = Field(..., description="The AI assistant's response")
    thinking: Optional[str] = Field(default=None, description="JIGGA thinking block (collapsed in UI)")
    meta: Dict[str, Any] = Field(default={}, description="Response metadata")


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


class PaymentType(str, Enum):
    """Type of payment - once-off, subscription, or tokenization."""
    ONCE_OFF = "once_off"
    SUBSCRIPTION = "subscription"
    TOKENIZATION = "tokenization"  # Card stored, we charge via API


class SubscriptionRequest(BaseModel):
    """Request to create a subscription payment."""
    user_email: EmailStr
    tier: str = Field(..., description="Subscription tier: 'jive' or 'jigga'")
    payment_type: PaymentType = Field(
        default=PaymentType.SUBSCRIPTION,
        description="Payment type: 'once_off' for single payment, 'subscription' for monthly recurring"
    )


class SubscriptionResponse(BaseModel):
    """Response after subscription/payment creation."""
    payment_url: str
    payment_data: Dict[str, Any]
    signature: str
    payment_id: str
    payment_type: str


# ============== Credit Pack Models ==============

class CreditPackSize(str, Enum):
    """Available credit pack sizes in ZAR."""
    SMALL = "200"
    MEDIUM = "500"
    LARGE = "1000"


class CreditPackRequest(BaseModel):
    """Request to purchase a credit pack."""
    user_email: EmailStr
    pack_size: CreditPackSize = Field(..., description="Credit pack size: '200', '500', or '1000' ZAR")


class CreditPackResponse(BaseModel):
    """Response after credit pack purchase request."""
    payment_url: str
    payment_data: Dict[str, Any]
    signature: str
    payment_id: str
    pack_size: str
    credits_amount: int


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
