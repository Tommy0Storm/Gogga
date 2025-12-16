"""
GOGGA Payment Endpoints
Handles PayFast subscription, one-time payments, and credit pack purchases.

Payment Types:
- Subscription: Monthly recurring (JIVE R99, JIGGA R299)
- Once-off: Single payment for tier access
- Credit Packs: Top-up credits (R200, R500, R1000)
"""
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.models.domain import (
    SubscriptionRequest, 
    SubscriptionResponse, 
    CreditPackRequest,
    CreditPackResponse,
    PaymentType,
    CreditPackSize
)
from app.services.payfast_service import payfast_service


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ============== Tier Definitions ==============

SUBSCRIPTION_TIERS = {
    "jive": {
        "name": "JIVE",
        "price_zar": 99.00,
        "tokens_per_month": 500000,
        "features": [
            "Cerebras Qwen 3 235B (~2,200 t/s)",
            "OptiLLM reasoning for complex queries",
            "FLUX 1.1 Pro images (200/month)",
            "5 RAG documents per session",
            "Chat history persistence",
            "Streaming responses",
            "AI Search (50/day)",
            "7-day research history"
        ]
    },
    "jigga": {
        "name": "JIGGA",
        "price_zar": 299.00,
        "tokens_per_month": 2000000,
        "features": [
            "Qwen 3 32B with thinking mode",
            "FLUX 1.1 Pro images (1,000/month)",
            "10 RAG documents per session",
            "Cross-session document access",
            "Semantic RAG with vector ranking",
            "Authoritative RAG mode",
            "RAG Analytics Dashboard",
            "Unlimited AI Search & Research",
            "Forever research history"
        ]
    }
}


# ============== Credit Pack Definitions ==============

CREDIT_PACKS = {
    "200": {
        "price_zar": 200.00,
        "credits": 50000,
        "description": "Small Credit Pack - 50,000 credits"
    },
    "500": {
        "price_zar": 500.00,
        "credits": 150000,
        "description": "Medium Credit Pack - 150,000 credits"
    },
    "1000": {
        "price_zar": 1000.00,
        "credits": 350000,
        "description": "Large Credit Pack - 350,000 credits"
    }
}


# ============== Tier Endpoints ==============

@router.get("/tiers")
async def list_tiers():
    """
    List available subscription tiers and pricing.
    
    Returns JIVE (R99/month) and JIGGA (R299/month) tier details.
    """
    return {"tiers": SUBSCRIPTION_TIERS}


@router.get("/credit-packs")
async def list_credit_packs():
    """
    List available credit pack options.
    
    Returns R200, R500, and R1000 credit pack details.
    """
    return {"credit_packs": CREDIT_PACKS}


# ============== Subscription Endpoints ==============

@router.post("/subscribe", response_model=SubscriptionResponse)
async def create_subscription(request: SubscriptionRequest):
    """
    Create a subscription or one-time payment for a tier.
    
    Supports both:
    - Monthly subscription (recurring)
    - Once-off payment (single payment for tier access)
    
    Returns form data that the frontend uses to redirect to PayFast.
    """
    tier_key = request.tier.lower()
    tier = SUBSCRIPTION_TIERS.get(tier_key)
    
    if not tier:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Available tiers: {list(SUBSCRIPTION_TIERS.keys())}"
        )
    
    # Generate payment form data based on payment type
    if request.payment_type == PaymentType.SUBSCRIPTION:
        # Monthly recurring subscription (PayFast auto-charges)
        form_data = payfast_service.generate_subscription_form(
            user_email=request.user_email,
            item_name=f"GOGGA {tier['name']} Monthly Subscription",
            amount=tier["price_zar"]
        )
        payment_type_str = "subscription"
    elif request.payment_type == PaymentType.TOKENIZATION:
        # Tokenization (we control billing via API)
        form_data = payfast_service.generate_tokenization_form(
            user_email=request.user_email,
            item_name=f"GOGGA {tier['name']} Tokenization Setup",
            amount=tier["price_zar"],  # Initial charge
            custom_str1="tokenization_setup",
            custom_str2=tier_key
        )
        payment_type_str = "tokenization"
    else:
        # Once-off payment
        form_data = payfast_service.generate_onetime_payment_form(
            user_email=request.user_email,
            item_name=f"GOGGA {tier['name']} (Once-off)",
            amount=tier["price_zar"],
            custom_str1="tier_purchase",
            custom_str2=tier_key
        )
        payment_type_str = "once_off"
    
    logger.info(f"📝 Payment form created: {tier['name']} - {payment_type_str} - R{tier['price_zar']}")
    
    return SubscriptionResponse(
        payment_url=form_data["process_url"],
        payment_data=form_data["form_data"],
        signature=form_data["form_data"]["signature"],
        payment_id=form_data["payment_id"],
        payment_type=payment_type_str
    )


# ============== Credit Pack Endpoints ==============

@router.post("/credit-pack", response_model=CreditPackResponse)
async def purchase_credit_pack(request: CreditPackRequest):
    """
    Purchase a credit pack for top-up.
    
    Available packs:
    - R200: 50,000 credits
    - R500: 150,000 credits
    - R1000: 350,000 credits
    
    Returns form data that the frontend uses to redirect to PayFast.
    """
    pack = CREDIT_PACKS.get(request.pack_size.value)
    
    if not pack:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid pack size. Available: 200, 500, 1000"
        )
    
    # Generate one-time payment form for credit pack
    form_data = payfast_service.generate_onetime_payment_form(
        user_email=request.user_email,
        item_name=pack["description"],
        amount=pack["price_zar"],
        custom_str1="credit_pack",
        custom_str2=request.pack_size.value
    )
    
    logger.info(f"💳 Credit pack purchase: R{pack['price_zar']} - {pack['credits']} credits")
    
    return CreditPackResponse(
        payment_url=form_data["process_url"],
        payment_data=form_data["form_data"],
        signature=form_data["form_data"]["signature"],
        payment_id=form_data["payment_id"],
        pack_size=request.pack_size.value,
        credits_amount=pack["credits"]
    )


# ============== PayFast Webhook (ITN) ==============

@router.post("/notify")
async def payfast_itn(request: Request):
    """
    PayFast Instant Transaction Notification (ITN) webhook.
    
    This endpoint receives notifications from PayFast about payment events.
    It handles:
    - Subscription activations/renewals
    - One-time tier purchases
    - Credit pack purchases
    - Subscription cancellations
    """
    # Get the raw form data
    form_data = await request.form()
    data = dict(form_data)
    
    # Get client IP for source verification
    client_ip = request.client.host if request.client else "unknown"
    
    # In production, verify the source IP
    # if not await payfast_service.verify_itn_source(client_ip):
    #     logger.warning(f"⚠️ ITN from invalid IP: {client_ip}")
    #     raise HTTPException(status_code=403, detail="Invalid source")
    
    # Verify the signature
    if not payfast_service.verify_itn_signature(data.copy()):
        logger.error("❌ ITN signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Extract payment details
    payment_status = data.get("payment_status")
    m_payment_id = data.get("m_payment_id", "")
    pf_payment_id = data.get("pf_payment_id")
    subscription_token = data.get("token")
    amount_gross = data.get("amount_gross", "0")
    email_address = data.get("email_address", "")
    
    # Custom fields for payment type identification
    custom_str1 = data.get("custom_str1", "")  # "tier_purchase" or "credit_pack"
    custom_str2 = data.get("custom_str2", "")  # tier name or pack size
    
    logger.info(f"📧 ITN Received: {payment_status} for {m_payment_id} (R{amount_gross})")
    
    if payment_status == "COMPLETE":
        # Determine payment type and process accordingly
        if m_payment_id.startswith("sub_"):
            # Subscription payment (monthly recurring)
            logger.info(f"✅ Subscription Payment Complete: {pf_payment_id}")
            logger.info(f"   Token: {subscription_token}")
            # TODO: Update user subscription in database
            # await activate_subscription(email_address, subscription_token)
            
        elif custom_str1 == "tier_purchase":
            # Once-off tier purchase
            tier = custom_str2
            logger.info(f"✅ Once-off Tier Purchase: {tier.upper()}")
            # TODO: Grant tier access for period
            # await grant_tier_access(email_address, tier)
            
        elif custom_str1 == "credit_pack":
            # Credit pack purchase
            pack_size = custom_str2
            credits = CREDIT_PACKS.get(pack_size, {}).get("credits", 0)
            logger.info(f"✅ Credit Pack Purchase: R{pack_size} ({credits} credits)")
            # TODO: Add credits to user account
            # await add_credits(email_address, credits)
            
        else:
            # Generic payment
            logger.info(f"✅ Payment Complete: {pf_payment_id}")
        
    elif payment_status == "CANCELLED":
        # Subscription cancelled
        logger.info(f"❌ Subscription Cancelled: {m_payment_id}")
        # TODO: Downgrade user to free tier
        # await cancel_subscription(email_address)
        
    elif payment_status == "PENDING":
        # Payment pending (common with EFT)
        logger.info(f"⏳ Payment Pending: {m_payment_id}")
        
    elif payment_status == "FAILED":
        # Payment failed
        logger.warning(f"❌ Payment Failed: {m_payment_id}")
    
    # PayFast expects a 200 OK response
    return {"status": "ok"}


# ============== Subscription Management ==============

@router.post("/cancel/{subscription_token}")
async def cancel_subscription(subscription_token: str):
    """
    Cancel a subscription.
    
    Uses PayFast's PUT API to cancel the recurring subscription.
    """
    success = await payfast_service.cancel_subscription(subscription_token)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to cancel subscription"
        )
    
    logger.info(f"🛑 Subscription cancelled: {subscription_token}")
    return {"status": "cancelled", "token": subscription_token}


# ============== Tokenization Charge Endpoint ==============

class ChargeTokenRequest(BaseModel):
    """Request to charge a stored tokenization token."""
    token: str = Field(..., description="PayFast tokenization token")
    amount: float = Field(..., gt=0, description="Amount to charge in ZAR")
    item_name: str = Field(..., description="Description of the charge")
    payment_id: str | None = Field(default=None, description="Optional unique payment ID")


@router.post("/charge-token")
async def charge_token(request: ChargeTokenRequest):
    """
    Charge a stored tokenization token.
    
    This endpoint is used for programmatic recurring billing when the merchant
    controls the billing schedule (tokenization mode, subscription_type=2).
    
    The token was obtained during the initial tokenization setup when the
    user first subscribed.
    
    Args:
        request: ChargeTokenRequest with token, amount, and item_name
        
    Returns:
        Success status and payment details
    """
    result = await payfast_service.charge_token(
        token=request.token,
        amount=request.amount,
        item_name=request.item_name,
        payment_id=request.payment_id
    )
    
    if not result["success"]:
        logger.error(f"💳 Token charge failed: {result.get('error')}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to charge token: {result.get('error')}"
        )
    
    logger.info(f"💳 Token charged: {request.amount} ZAR - {result.get('pf_payment_id')}")
    return result


@router.get("/verify/{payment_id}")
async def verify_payment(payment_id: str):
    """
    Verify a payment status.
    
    Returns payment status from the database.
    """
    # TODO: Query the database for payment status
    return {
        "payment_id": payment_id,
        "status": "verified",
        "message": "Payment verification - database lookup not implemented"
    }
