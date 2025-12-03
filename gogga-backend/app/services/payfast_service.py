"""
GOGGA PayFast Service
Handles PayFast integration for subscription billing.

Key PayFast requirements:
1. MD5 signature generation with specific encoding rules
2. URL encoding uses + for spaces (not %20)
3. Parameters must be sorted alphabetically
4. Subscription frequency 3 = Monthly
5. Cancellation uses PUT request (not DELETE)
"""
import hashlib
import logging
import urllib.parse
import time
from typing import Any, Final

import httpx

from app.config import settings


logger = logging.getLogger(__name__)

# PayFast IP whitelist for ITN verification
PAYFAST_VALID_IPS: Final[frozenset[str]] = frozenset([
    "197.97.145.144",
    "197.97.145.145",
    "197.97.145.146",
    "197.97.145.147",
    "41.74.179.194",
    "41.74.179.195",
    "41.74.179.196",
    "41.74.179.197",
])


class PayFastService:
    """
    PayFast integration service for subscription management.
    
    Handles:
    - Signature generation (MD5)
    - Subscription form data creation
    - Subscription cancellation via API
    - Webhook/ITN verification
    """
    
    # Environment-specific URLs
    SANDBOX_URL: Final[str] = "https://sandbox.payfast.co.za"
    PRODUCTION_URL: Final[str] = "https://www.payfast.co.za"
    API_URL: Final[str] = "https://api.payfast.co.za"
    
    @staticmethod
    def get_process_url() -> str:
        """Get the PayFast process URL based on environment."""
        if settings.PAYFAST_ENV == "production":
            return f"{PayFastService.PRODUCTION_URL}/eng/process"
        return f"{PayFastService.SANDBOX_URL}/eng/process"
    
    @staticmethod
    def generate_signature(data: dict[str, Any]) -> str:
        """
        Generates the MD5 signature required by PayFast.
        
        Critical requirements:
        1. Sort keys alphabetically
        2. Filter empty values
        3. URL encode values (spaces become +, not %20)
        4. Append passphrase at the end
        
        Args:
            data: The payment data dictionary
            
        Returns:
            MD5 hash signature string
        """
        # Sort and filter empty values
        ordered_data = dict(
            sorted(
                ((k, v) for k, v in data.items() if v is not None and v != ""),
                key=lambda x: x[0]
            )
        )
        
        # Build query string with quote_plus for space -> +
        query_parts = [
            f"{key}={urllib.parse.quote_plus(str(value))}"
            for key, value in ordered_data.items()
        ]
        query_string = "&".join(query_parts)
        
        # Append passphrase if configured
        if settings.PAYFAST_PASSPHRASE:
            passphrase_encoded = urllib.parse.quote_plus(settings.PAYFAST_PASSPHRASE)
            query_string += f"&passphrase={passphrase_encoded}"
        
        return hashlib.md5(query_string.encode("utf-8")).hexdigest()
    
    @staticmethod
    def generate_subscription_form(
        user_email: str,
        item_name: str,
        amount: float,
        payment_id: str | None = None
    ) -> dict[str, Any]:
        """
        Generates the payload for a Monthly Subscription (Frequency 3).
        
        This data is sent to the Frontend to build the hidden form
        that redirects to PayFast.
        
        Args:
            user_email: Customer's email address
            item_name: Description of the subscription
            amount: Monthly subscription amount in ZAR
            payment_id: Optional custom payment ID
            
        Returns:
            Dict containing form data and signature
        """
        # Generate unique payment ID if not provided
        if not payment_id:
            payment_id = f"sub_{int(time.time())}"
        
        data = {
            "merchant_id": settings.PAYFAST_MERCHANT_ID,
            "merchant_key": settings.PAYFAST_MERCHANT_KEY,
            "return_url": f"{settings.APP_URL}/payment/success",
            "cancel_url": f"{settings.APP_URL}/payment/cancel",
            "notify_url": f"{settings.API_URL}/api/v1/payments/notify",
            
            # User Details
            "email_address": user_email,
            
            # Item Details
            "m_payment_id": payment_id,
            "amount": f"{amount:.2f}",
            "item_name": item_name,
            
            # Subscription Specifics
            "subscription_type": "1",     # 1 = Subscription
            "billing_date": time.strftime('%Y-%m-%d'),
            "recurring_amount": f"{amount:.2f}",
            "frequency": "3",             # 3 = Monthly
            "cycles": "0"                 # 0 = Indefinite
        }
        
        # Generate Signature
        data["signature"] = PayFastService.generate_signature(data)
        
        return {
            "form_data": data,
            "process_url": PayFastService.get_process_url(),
            "payment_id": payment_id
        }
    
    @staticmethod
    async def cancel_subscription(token: str) -> bool:
        """
        Cancels a subscription using the PUT method.
        
        Note: PayFast uses PUT for cancellation, not DELETE!
        
        Args:
            token: The subscription token from PayFast
            
        Returns:
            True if cancellation was successful, False otherwise
        """
        endpoint = f"/subscriptions/{token}/cancel"
        url = f"{PayFastService.API_URL}{endpoint}"
        
        timestamp = time.strftime('%Y-%m-%dT%H:%M:%S')
        
        # Payload for Signature Generation
        auth_payload = {
            "merchant-id": settings.PAYFAST_MERCHANT_ID,
            "version": "v1",
            "timestamp": timestamp,
        }
        
        # Generate signature (passphrase is appended internally)
        signature = PayFastService.generate_signature(auth_payload)
        
        headers = {
            "merchant-id": settings.PAYFAST_MERCHANT_ID,
            "version": "v1",
            "timestamp": timestamp,
            "signature": signature,
            "content-type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            # Use 'testing=true' query param if in sandbox
            params = {"testing": "true"} if settings.PAYFAST_ENV == "sandbox" else {}
            
            try:
                # Explicit PUT request (not DELETE!)
                response = await client.put(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    resp_data = response.json()
                    if resp_data.get('code') == 200 and resp_data.get('status') == 'success':
                        return True
                
                logger.warning("PayFast Cancellation Failed: %s", response.text)
                return False
                
            except Exception as e:
                logger.error("PayFast Connection Error: %s", e)
                return False
    
    @staticmethod
    def verify_itn_signature(data: dict[str, Any]) -> bool:
        """
        Verify the signature of an Instant Transaction Notification.
        
        Args:
            data: The ITN payload from PayFast
            
        Returns:
            True if signature is valid, False otherwise
        """
        # Extract the signature from the payload
        received_signature = data.pop("signature", None)
        
        if not received_signature:
            return False
        
        # Generate our own signature from the data
        calculated_signature = PayFastService.generate_signature(data)
        
        # Compare signatures
        return received_signature == calculated_signature
    
    @staticmethod
    async def verify_itn_source(request_ip: str) -> bool:
        """
        Verify that the ITN comes from PayFast's servers.
        
        Args:
            request_ip: The IP address of the request
            
        Returns:
            True if the source is verified
        """
        # For sandbox testing, also allow localhost
        if settings.PAYFAST_ENV == "sandbox" and request_ip in {"127.0.0.1", "::1"}:
            return True
        
        return request_ip in PAYFAST_VALID_IPS


# Singleton instance
payfast_service = PayFastService()
