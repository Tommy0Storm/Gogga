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
    def generate_signature(data: dict[str, Any], use_payfast_order: bool = True) -> str:
        """
        Generates the MD5 signature required by PayFast.
        
        Critical requirements:
        1. For form submissions (subscriptions, payments): use PayFast field order, NOT alphabetical
        2. For API calls: use alphabetical order
        3. Filter empty values
        4. URL encode values (spaces become +, not %20)
        5. Append passphrase at the end
        
        Note: PayFast docs explicitly state:
        "The pairs must be listed in the order in which they appear in the attributes description"
        "Do not use the API signature format, which uses alphabetical ordering!"
        
        Args:
            data: The payment data dictionary
            use_payfast_order: If True, use PayFast documentation field order; if False, use alphabetical
            
        Returns:
            MD5 hash signature string
        """
        # PayFast's required field order for form submissions (subscriptions/payments)
        PAYFAST_FIELD_ORDER = [
            # Merchant details
            "merchant_id", "merchant_key",
            # Return URLs  
            "return_url", "cancel_url", "notify_url",
            # Buyer details
            "name_first", "name_last", "email_address", "cell_number",
            # Transaction details
            "m_payment_id", "amount", "item_name", "item_description",
            # Custom fields
            "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
            "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
            # Subscription details
            "subscription_type", "billing_date", "recurring_amount", "frequency", "cycles",
            # Payment method
            "payment_method", "email_confirmation", "confirmation_address",
        ]
        
        if use_payfast_order:
            # Build ordered dict following PayFast's required field order
            ordered_items = []
            for key in PAYFAST_FIELD_ORDER:
                if key in data and data[key] is not None and data[key] != "":
                    ordered_items.append((key, data[key]))
            # Add any extra fields that aren't in the standard order (alphabetically)
            for key, value in sorted(data.items()):
                if key not in PAYFAST_FIELD_ORDER and value is not None and value != "":
                    ordered_items.append((key, value))
        else:
            # API calls use alphabetical order
            ordered_items = [
                (k, v) for k, v in sorted(data.items()) 
                if v is not None and v != ""
            ]
        
        # Build query string with quote_plus for space -> +
        query_parts = [
            f"{key}={urllib.parse.quote_plus(str(value))}"
            for key, value in ordered_items
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
            "notify_url": f"{settings.APP_URL}/api/payfast/notify",
            
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
    def generate_onetime_payment_form(
        user_email: str,
        item_name: str,
        amount: float,
        payment_id: str | None = None,
        custom_str1: str | None = None,
        custom_str2: str | None = None
    ) -> dict[str, Any]:
        """
        Generates the payload for a One-Time Payment (no subscription).
        
        This data is sent to the Frontend to build the hidden form
        that redirects to PayFast.
        
        Args:
            user_email: Customer's email address
            item_name: Description of the purchase
            amount: Payment amount in ZAR
            payment_id: Optional custom payment ID
            custom_str1: Optional custom string field (e.g., 'tier_purchase' or 'credit_pack')
            custom_str2: Optional custom string field (e.g., tier name or pack size)
            
        Returns:
            Dict containing form data and signature
        """
        # Generate unique payment ID if not provided
        if not payment_id:
            payment_id = f"pay_{int(time.time())}"
        
        data = {
            "merchant_id": settings.PAYFAST_MERCHANT_ID,
            "merchant_key": settings.PAYFAST_MERCHANT_KEY,
            "return_url": f"{settings.APP_URL}/payment/success",
            "cancel_url": f"{settings.APP_URL}/payment/cancel",
            "notify_url": f"{settings.APP_URL}/api/payfast/notify",
            
            # User Details
            "email_address": user_email,
            
            # Item Details
            "m_payment_id": payment_id,
            "amount": f"{amount:.2f}",
            "item_name": item_name,
        }
        
        # Add optional custom fields for tracking payment type
        if custom_str1:
            data["custom_str1"] = custom_str1
        if custom_str2:
            data["custom_str2"] = custom_str2
        
        # Generate Signature
        data["signature"] = PayFastService.generate_signature(data)
        
        return {
            "form_data": data,
            "process_url": PayFastService.get_process_url(),
            "payment_id": payment_id
        }

    @staticmethod
    def generate_tokenization_form(
        user_email: str,
        item_name: str,
        amount: float,
        payment_id: str | None = None,
        custom_str1: str | None = None,
        custom_str2: str | None = None
    ) -> dict[str, Any]:
        """
        Generates the payload for a Tokenization Payment (subscription_type=2).
        
        Tokenization allows storing the customer's card for future charges.
        Unlike subscription (type=1), PayFast does NOT auto-charge monthly.
        Instead, YOU call the adhoc charge API when you want to bill.
        
        This is ideal for:
        - Flexible billing dates
        - Variable amounts
        - Programmatic control over billing
        
        Args:
            user_email: Customer's email address
            item_name: Description of the payment
            amount: Initial payment amount in ZAR (can be 0 for card setup only)
            payment_id: Optional custom payment ID
            custom_str1: Optional custom field (e.g., 'tokenization_setup')
            custom_str2: Optional custom field (e.g., tier name)
            
        Returns:
            Dict containing form data and signature
        """
        # Generate unique payment ID if not provided
        if not payment_id:
            payment_id = f"tok_{int(time.time())}"
        
        data = {
            "merchant_id": settings.PAYFAST_MERCHANT_ID,
            "merchant_key": settings.PAYFAST_MERCHANT_KEY,
            "return_url": f"{settings.APP_URL}/payment/success",
            "cancel_url": f"{settings.APP_URL}/payment/cancel",
            "notify_url": f"{settings.APP_URL}/api/payfast/notify",
            
            # User Details
            "email_address": user_email,
            
            # Item Details
            "m_payment_id": payment_id,
            "amount": f"{amount:.2f}",
            "item_name": item_name,
            
            # Tokenization - PayFast stores card, we charge via API
            "subscription_type": "2",  # 2 = Tokenization
        }
        
        # Add optional custom fields for tracking payment type
        if custom_str1:
            data["custom_str1"] = custom_str1
        if custom_str2:
            data["custom_str2"] = custom_str2
        
        # Generate Signature
        data["signature"] = PayFastService.generate_signature(data)
        
        return {
            "form_data": data,
            "process_url": PayFastService.get_process_url(),
            "payment_id": payment_id
        }
    
    @staticmethod
    async def charge_token(
        token: str,
        amount: float,
        item_name: str,
        payment_id: str | None = None
    ) -> dict[str, Any]:
        """
        Charge a stored tokenization token via PayFast adhoc API.
        
        This is used for recurring billing when you control the schedule.
        The token was obtained during initial tokenization setup.
        
        Args:
            token: The PayFast token from tokenization setup
            amount: Amount to charge in ZAR
            item_name: Description of the charge
            payment_id: Optional unique payment ID for tracking
            
        Returns:
            Dict with success status and response data
        """
        if not payment_id:
            payment_id = f"chg_{int(time.time())}"
        
        endpoint = f"/subscriptions/{token}/adhoc"
        url = f"{PayFastService.API_URL}{endpoint}"
        
        timestamp = time.strftime('%Y-%m-%dT%H:%M:%S')
        
        # Headers for authentication
        auth_payload = {
            "merchant-id": settings.PAYFAST_MERCHANT_ID,
            "version": "v1",
            "timestamp": timestamp,
        }
        
        # Generate signature for headers
        signature = PayFastService.generate_signature(auth_payload, use_payfast_order=False)
        
        headers = {
            "merchant-id": settings.PAYFAST_MERCHANT_ID,
            "version": "v1",
            "timestamp": timestamp,
            "signature": signature,
            "content-type": "application/json"
        }
        
        # Request body for the charge
        body = {
            "amount": int(amount * 100),  # PayFast API expects cents
            "item_name": item_name,
            "m_payment_id": payment_id,
        }
        
        async with httpx.AsyncClient() as client:
            # Use 'testing=true' query param if in sandbox
            params = {"testing": "true"} if settings.PAYFAST_ENV == "sandbox" else {}
            
            try:
                response = await client.post(url, headers=headers, json=body, params=params)
                
                logger.info(f"PayFast Adhoc Charge Response: {response.status_code} - {response.text}")
                
                if response.status_code == 200:
                    resp_data = response.json()
                    if resp_data.get('code') == 200 and resp_data.get('status') == 'success':
                        return {
                            "success": True,
                            "payment_id": payment_id,
                            "pf_payment_id": resp_data.get('data', {}).get('pf_payment_id'),
                            "response": resp_data
                        }
                
                return {
                    "success": False,
                    "payment_id": payment_id,
                    "error": response.text,
                    "status_code": response.status_code
                }
                
            except Exception as e:
                logger.error(f"PayFast Adhoc Charge Error: {e}")
                return {
                    "success": False,
                    "payment_id": payment_id,
                    "error": str(e)
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
        # API calls use alphabetical order, not PayFast form field order
        signature = PayFastService.generate_signature(auth_payload, use_payfast_order=False)
        
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
