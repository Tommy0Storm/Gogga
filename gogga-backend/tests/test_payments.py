"""
Tests for PayFast Payment Integration
"""
import pytest
from app.services.payfast_service import payfast_service


class TestPayFastSignature:
    """Test PayFast signature generation."""
    
    def test_signature_is_md5_hash(self):
        """Signature should be a valid MD5 hash (32 hex chars)."""
        data = {
            "merchant_id": "10000100",
            "merchant_key": "46f0cd694581a",
            "amount": "100.00",
            "item_name": "Test Item"
        }
        
        signature = payfast_service.generate_signature(data)
        
        assert len(signature) == 32, "MD5 hash should be 32 characters"
        assert all(c in '0123456789abcdef' for c in signature), "Should be hex"
    
    def test_signature_excludes_empty_values(self):
        """Empty values should be excluded from signature."""
        data_with_empty = {
            "merchant_id": "10000100",
            "empty_field": "",
            "none_field": None,
            "amount": "100.00"
        }
        
        data_without_empty = {
            "merchant_id": "10000100",
            "amount": "100.00"
        }
        
        sig1 = payfast_service.generate_signature(data_with_empty)
        sig2 = payfast_service.generate_signature(data_without_empty)
        
        # Signatures should match since empty values are excluded
        assert sig1 == sig2, "Empty values should be filtered out"
    
    def test_signature_is_alphabetically_sorted(self):
        """Keys should be sorted alphabetically for signature."""
        data_unsorted = {
            "z_field": "last",
            "a_field": "first",
            "m_field": "middle"
        }
        
        data_sorted = {
            "a_field": "first",
            "m_field": "middle",
            "z_field": "last"
        }
        
        sig1 = payfast_service.generate_signature(data_unsorted)
        sig2 = payfast_service.generate_signature(data_sorted)
        
        assert sig1 == sig2, "Sorting should be handled internally"


class TestSubscriptionForm:
    """Test subscription form generation."""
    
    def test_form_contains_required_fields(self):
        """Generated form should have all required PayFast fields."""
        result = payfast_service.generate_subscription_form(
            user_email="test@example.com",
            item_name="Test Subscription",
            amount=99.00
        )
        
        form_data = result["form_data"]
        required_fields = [
            "merchant_id",
            "merchant_key",
            "email_address",
            "amount",
            "item_name",
            "subscription_type",
            "frequency",
            "signature"
        ]
        
        for field in required_fields:
            assert field in form_data, f"Missing required field: {field}"
    
    def test_frequency_is_monthly(self):
        """Subscription frequency should be 3 (Monthly)."""
        result = payfast_service.generate_subscription_form(
            user_email="test@example.com",
            item_name="Test",
            amount=49.00
        )
        
        assert result["form_data"]["frequency"] == "3", "Frequency 3 = Monthly"
    
    def test_amount_is_formatted_correctly(self):
        """Amount should be formatted to 2 decimal places."""
        result = payfast_service.generate_subscription_form(
            user_email="test@example.com",
            item_name="Test",
            amount=149.5
        )
        
        assert result["form_data"]["amount"] == "149.50"
        assert result["form_data"]["recurring_amount"] == "149.50"
    
    def test_process_url_returned(self):
        """Form should include the PayFast process URL."""
        result = payfast_service.generate_subscription_form(
            user_email="test@example.com",
            item_name="Test",
            amount=49.00
        )
        
        assert "process_url" in result
        assert "payfast" in result["process_url"]


class TestITNVerification:
    """Test Instant Transaction Notification verification."""
    
    def test_valid_signature_verification(self):
        """Valid signature should pass verification."""
        # Create test data with a signature
        data = {
            "merchant_id": "10000100",
            "amount": "100.00",
            "item_name": "Test"
        }
        
        # Generate signature
        signature = payfast_service.generate_signature(data)
        data["signature"] = signature
        
        # Should verify successfully
        result = payfast_service.verify_itn_signature(data.copy())
        assert result is True, "Valid signature should verify"
    
    def test_invalid_signature_fails_verification(self):
        """Invalid signature should fail verification."""
        data = {
            "merchant_id": "10000100",
            "amount": "100.00",
            "item_name": "Test",
            "signature": "invalid_signature_here"
        }
        
        result = payfast_service.verify_itn_signature(data)
        assert result is False, "Invalid signature should not verify"
    
    def test_missing_signature_fails_verification(self):
        """Missing signature should fail verification."""
        data = {
            "merchant_id": "10000100",
            "amount": "100.00"
        }
        
        result = payfast_service.verify_itn_signature(data)
        assert result is False, "Missing signature should not verify"
