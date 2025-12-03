"""
GOGGA Payment Endpoints
Handles PayFast subscription and webhook processing.
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Form

from app.models.domain import SubscriptionRequest, SubscriptionResponse, PayFastNotification
from app.services.payfast_service import payfast_service
from app.core.exceptions import PaymentError


router = APIRouter(prefix="/payments", tags=["Payments"])


# Subscription Tier Definitions
SUBSCRIPTION_TIERS = {
    "starter": {
        "name": "Starter",
        "price_zar": 49.00,
        "tokens_per_month": 50000,
        "features": ["Speed Layer access", "5,000 messages/month", "Email support"]
    },
    "professional": {
        "name": "Professional",
        "price_zar": 149.00,
        "tokens_per_month": 200000,
        "features": [
            "Speed & Complex Layer access",
            "20,000 messages/month",
            "Legal document analysis",
            "Priority support"
        ]
    },
    "enterprise": {
        "name": "Enterprise",
        "price_zar": 499.00,
        "tokens_per_month": 1000000,
        "features": [
            "Unlimited Layer access",
            "100,000 messages/month",
            "Custom integrations",
            "Dedicated support",
            "API access"
        ]
    }
}


@router.get("/tiers")
async def list_tiers():
    """
    List available subscription tiers and pricing.
    """
    return {"tiers": SUBSCRIPTION_TIERS}


@router.post("/subscribe", response_model=SubscriptionResponse)
async def create_subscription(request: SubscriptionRequest):
    """
    Create a subscription payment form for PayFast.
    
    Returns form data that the frontend uses to redirect to PayFast.
    """
    tier = SUBSCRIPTION_TIERS.get(request.tier)
    
    if not tier:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Available tiers: {list(SUBSCRIPTION_TIERS.keys())}"
        )
    
    # Generate subscription form data
    form_data = payfast_service.generate_subscription_form(
        user_email=request.user_email,
        item_name=f"Gogga {tier['name']} Subscription",
        amount=tier["price_zar"]
    )
    
    return SubscriptionResponse(
        payment_url=form_data["process_url"],
        payment_data=form_data["form_data"],
        signature=form_data["form_data"]["signature"]
    )


@router.post("/notify")
async def payfast_itn(request: Request):
    """
    PayFast Instant Transaction Notification (ITN) webhook.
    
    This endpoint receives notifications from PayFast about payment events.
    It must verify the signature and source IP before processing.
    """
    # Get the raw form data
    form_data = await request.form()
    data = dict(form_data)
    
    # Get client IP for source verification
    client_ip = request.client.host
    
    # In production, verify the source IP
    # if not await payfast_service.verify_itn_source(client_ip):
    #     raise HTTPException(status_code=403, detail="Invalid source")
    
    # Verify the signature
    if not payfast_service.verify_itn_signature(data.copy()):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Process the payment notification
    payment_status = data.get("payment_status")
    m_payment_id = data.get("m_payment_id")
    pf_payment_id = data.get("pf_payment_id")
    subscription_token = data.get("token")
    
    print(f"📧 ITN Received: {payment_status} for {m_payment_id}")
    
    if payment_status == "COMPLETE":
        # Payment successful
        # In production: Update user subscription in database
        # await update_user_subscription(m_payment_id, subscription_token)
        print(f"✅ Payment Complete: {pf_payment_id}")
        
    elif payment_status == "CANCELLED":
        # Subscription cancelled
        # In production: Downgrade user to free tier
        print(f"❌ Subscription Cancelled: {m_payment_id}")
        
    elif payment_status == "PENDING":
        # Payment pending (common with EFT)
        print(f"⏳ Payment Pending: {m_payment_id}")
    
    # PayFast expects a 200 OK response
    return {"status": "ok"}


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
    
    return {"status": "cancelled", "token": subscription_token}


@router.get("/verify/{payment_id}")
async def verify_payment(payment_id: str):
    """
    Verify a payment status.
    
    Placeholder for payment verification logic.
    """
    # In production, query the database for payment status
    return {
        "payment_id": payment_id,
        "status": "verified",
        "message": "Payment verification placeholder"
    }
