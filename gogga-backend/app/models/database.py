"""
GOGGA Database Models
SQLModel schemas for database persistence.
"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON


# ============== User Table ==============

class User(SQLModel, table=True):
    """User account table."""
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    uid: str = Field(index=True, unique=True, description="Public user ID")
    email: str = Field(index=True, unique=True)
    name: Optional[str] = None
    password_hash: str
    
    # Subscription Info
    subscription_tier: str = Field(default="free")
    subscription_token: Optional[str] = None  # PayFast subscription token
    subscription_expires: Optional[datetime] = None
    
    # Usage Tracking
    tokens_used_month: int = Field(default=0)
    tokens_limit: int = Field(default=10000)  # Free tier limit
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    conversations: List["Conversation"] = Relationship(back_populates="user")
    token_ledger: List["TokenLedger"] = Relationship(back_populates="user")


# ============== Conversation Table ==============

class Conversation(SQLModel, table=True):
    """Conversation history table."""
    __tablename__ = "conversations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    uid: str = Field(index=True, unique=True, description="Public conversation ID")
    
    # Foreign Key
    user_id: int = Field(foreign_key="users.id")
    user: Optional[User] = Relationship(back_populates="conversations")
    
    # Conversation metadata
    title: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Messages stored as JSON
    messages: List[dict] = Field(default=[], sa_column=Column(JSON))


# ============== Token Ledger Table ==============

class TokenLedger(SQLModel, table=True):
    """Token usage ledger for precise cost tracking."""
    __tablename__ = "token_ledger"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign Key
    user_id: int = Field(foreign_key="users.id", index=True)
    user: Optional[User] = Relationship(back_populates="token_ledger")
    
    # Usage Details
    model: str = Field(description="Model ID used for inference")
    layer: str = Field(description="'speed' or 'complex'")
    input_tokens: int
    output_tokens: int
    
    # Cost Breakdown
    cost_usd: float
    cost_zar: float
    exchange_rate: float = Field(description="ZAR/USD rate at time of transaction")
    
    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============== Payment Transaction Table ==============

class PaymentTransaction(SQLModel, table=True):
    """Payment transaction record."""
    __tablename__ = "payment_transactions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign Key
    user_id: int = Field(foreign_key="users.id", index=True)
    
    # PayFast Reference
    m_payment_id: str = Field(index=True, description="Internal payment ID")
    pf_payment_id: Optional[str] = Field(description="PayFast payment ID")
    
    # Transaction Details
    payment_status: str
    item_name: str
    amount_gross: float
    amount_fee: float
    amount_net: float
    
    # Subscription Token (if subscription payment)
    subscription_token: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============== API Key Table ==============

class APIKey(SQLModel, table=True):
    """API keys for programmatic access."""
    __tablename__ = "api_keys"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign Key
    user_id: int = Field(foreign_key="users.id", index=True)
    
    # Key Details
    key_hash: str = Field(description="SHA256 hash of the API key")
    name: str = Field(description="User-friendly name for the key")
    
    # Permissions
    scopes: List[str] = Field(default=["chat"], sa_column=Column(JSON))
    
    # Rate Limiting
    rate_limit: int = Field(default=100, description="Requests per minute")
    
    # Status
    is_active: bool = Field(default=True)
    last_used: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
