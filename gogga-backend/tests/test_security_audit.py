"""
GOGGA Security Audit Tests - December 2025

Tests for security fixes implemented during the enterprise audit:
- SEC-002: JWT signing with PyJWT (HS256)
- SEC-003: Admin authentication middleware
- SEC-005: Tier bypass protection
- SEC-006: PayFast ITN IP verification

Run with: pytest tests/test_security_audit.py -v
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException


class TestJWTSecurity:
    """Tests for SEC-002: Proper JWT signing with PyJWT."""
    
    def test_jwt_creation_returns_three_parts(self):
        """JWT should have header.payload.signature format."""
        from app.core.security import create_access_token
        
        token = create_access_token({"sub": "test@example.com", "tier": "jive"})
        parts = token.split('.')
        
        assert len(parts) == 3, "JWT must have 3 parts (header.payload.signature)"
    
    def test_jwt_verification_extracts_claims(self):
        """JWT verification should extract embedded claims."""
        from app.core.security import create_access_token, verify_access_token
        
        original_data = {"sub": "test@example.com", "tier": "jigga", "role": "admin"}
        token = create_access_token(original_data)
        
        payload = verify_access_token(token)
        
        assert payload.get("sub") == "test@example.com"
        assert payload.get("tier") == "jigga"
        assert payload.get("role") == "admin"
    
    def test_jwt_invalid_token_rejected(self):
        """Invalid tokens should raise HTTPException."""
        from app.core.security import verify_access_token
        
        with pytest.raises(HTTPException) as exc_info:
            verify_access_token("invalid.token.here")
        
        assert exc_info.value.status_code == 401
    
    def test_jwt_tampered_token_rejected(self):
        """Tampered tokens should be rejected."""
        from app.core.security import create_access_token, verify_access_token
        
        token = create_access_token({"sub": "user@test.com"})
        # Tamper with the payload
        parts = token.split('.')
        tampered = parts[0] + "." + parts[1] + "x" + "." + parts[2]
        
        with pytest.raises(HTTPException):
            verify_access_token(tampered)
    
    def test_jwt_empty_token_rejected(self):
        """Empty tokens should be rejected."""
        from app.core.security import verify_access_token
        
        with pytest.raises(HTTPException):
            verify_access_token("")
    
    def test_jwt_none_token_rejected(self):
        """None tokens should be rejected."""
        from app.core.security import verify_access_token
        
        with pytest.raises(HTTPException):
            verify_access_token(None)


class TestAdminAuthentication:
    """Tests for SEC-003: Admin endpoint authentication."""
    
    @pytest.mark.asyncio
    async def test_require_admin_rejects_no_credentials(self):
        """require_admin should reject requests without credentials."""
        from app.core.security import require_admin
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_secret=None, authorization=None)
        
        assert exc_info.value.status_code == 403
    
    @pytest.mark.asyncio
    async def test_require_admin_accepts_valid_secret(self):
        """require_admin should accept valid X-Admin-Secret header."""
        from app.core.security import require_admin
        from app.config import settings
        
        # Use the configured admin secret
        admin_secret = getattr(settings, 'ADMIN_SECRET', 'admin-secret-change-in-production')
        
        result = await require_admin(x_admin_secret=admin_secret, authorization=None)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_require_admin_rejects_wrong_secret(self):
        """require_admin should reject incorrect admin secret."""
        from app.core.security import require_admin
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_secret="wrong-secret", authorization=None)
        
        assert exc_info.value.status_code == 403
    
    @pytest.mark.asyncio
    async def test_require_admin_accepts_admin_jwt(self):
        """require_admin should accept valid admin JWT."""
        from app.core.security import require_admin, create_access_token
        
        # Create admin JWT
        token = create_access_token({"sub": "admin@gogga.ai", "role": "admin"})
        auth_header = f"Bearer {token}"
        
        result = await require_admin(x_admin_secret=None, authorization=auth_header)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_require_admin_rejects_non_admin_jwt(self):
        """require_admin should reject JWT without admin role."""
        from app.core.security import require_admin, create_access_token
        
        # Create regular user JWT
        token = create_access_token({"sub": "user@example.com", "role": "user"})
        auth_header = f"Bearer {token}"
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(x_admin_secret=None, authorization=auth_header)
        
        assert exc_info.value.status_code == 403


class TestTierBypassProtection:
    """Tests for SEC-005: Tier bypass via X-User-Tier header."""
    
    def test_dev_allow_tier_override_default_false(self):
        """DEV_ALLOW_TIER_OVERRIDE should default to False."""
        from app.core.auth import DEV_ALLOW_TIER_OVERRIDE
        
        # In production, this MUST be False
        assert DEV_ALLOW_TIER_OVERRIDE is False, (
            "SECURITY: DEV_ALLOW_TIER_OVERRIDE must be False in production!"
        )
    
    @pytest.mark.asyncio
    async def test_tier_header_ignored_when_dev_mode_off(self):
        """X-User-Tier header should be ignored when DEV_ALLOW_TIER_OVERRIDE is False."""
        from app.core.auth import get_current_user_tier, DEV_ALLOW_TIER_OVERRIDE
        from app.core.router import UserTier
        
        if not DEV_ALLOW_TIER_OVERRIDE:
            # When dev mode is off, header should be ignored
            tier = await get_current_user_tier(
                x_user_tier="jigga",  # Attempting to claim premium tier
                x_api_key=None,
                authorization=None
            )
            # Should default to FREE, not accept the claimed tier
            assert tier == UserTier.FREE
    
    @pytest.mark.asyncio
    async def test_jwt_tier_claim_takes_priority(self):
        """JWT tier claim should be trusted over header."""
        from app.core.auth import get_current_user_tier
        from app.core.security import create_access_token
        from app.core.router import UserTier
        
        # Create JWT with JIVE tier
        token = create_access_token({"sub": "user@test.com", "tier": "jive"})
        auth_header = f"Bearer {token}"
        
        tier = await get_current_user_tier(
            x_user_tier="jigga",  # Header claims higher tier
            x_api_key=None,
            authorization=auth_header
        )
        
        # JWT tier should be used, not header
        assert tier == UserTier.JIVE


class TestPatternMatcher:
    """Tests for PERF-005: Aho-Corasick pattern matching optimization."""
    
    def test_pattern_matcher_singleton_exists(self):
        """Pattern matcher singleton should be accessible."""
        from app.core.router import get_pattern_matcher
        
        pm = get_pattern_matcher()
        assert pm is not None
    
    def test_pattern_matcher_finds_complex_output(self):
        """Pattern matcher should detect COMPLEX_OUTPUT keywords."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        result = pm.find_categories("write me a comprehensive report about popia compliance")
        
        assert PatternCategory.COMPLEX_OUTPUT in result
    
    def test_pattern_matcher_finds_complex_235b(self):
        """Pattern matcher should detect COMPLEX_235B keywords."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        result = pm.find_categories("analyze the constitutional implications of this law")
        
        assert PatternCategory.COMPLEX_235B in result
    
    def test_pattern_matcher_finds_sa_bantu_languages(self):
        """Pattern matcher should detect South African language patterns."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        
        # Test Zulu
        result = pm.find_categories("sawubona, ngiyabonga for your help")
        assert PatternCategory.SA_BANTU in result
        
        # Test Xhosa
        result = pm.find_categories("molo, enkosi kakhulu")
        assert PatternCategory.SA_BANTU in result
    
    def test_pattern_matcher_finds_image_prompts(self):
        """Pattern matcher should detect image generation requests."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        result = pm.find_categories("draw me a picture of a sunset")
        
        assert PatternCategory.IMAGE in result
    
    def test_pattern_matcher_multiple_categories(self):
        """Pattern matcher should find multiple matching categories."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        # This message should match multiple categories
        result = pm.find_categories(
            "write me a comprehensive report with detailed analysis about popia"
        )
        
        # Should match both complex output and 235B keywords
        assert len(result) >= 2
        assert PatternCategory.COMPLEX_OUTPUT in result or PatternCategory.COMPLEX_235B in result
    
    def test_pattern_matcher_case_insensitive(self):
        """Pattern matching should be case-insensitive."""
        from app.core.router import get_pattern_matcher, PatternCategory
        
        pm = get_pattern_matcher()
        
        # Mixed case
        result1 = pm.find_categories("COMPREHENSIVE REPORT")
        result2 = pm.find_categories("comprehensive report")
        result3 = pm.find_categories("Comprehensive Report")
        
        assert result1 == result2 == result3
    
    def test_pattern_matcher_empty_message(self):
        """Pattern matcher should handle empty messages gracefully."""
        from app.core.router import get_pattern_matcher
        
        pm = get_pattern_matcher()
        result = pm.find_categories("")
        
        assert isinstance(result, set)
        assert len(result) == 0


class TestPayFastIPVerification:
    """Tests for SEC-006: PayFast ITN IP verification."""
    
    @pytest.mark.asyncio
    async def test_payfast_valid_ips_defined(self):
        """PayFast valid IPs should be defined."""
        from app.services.payfast_service import PAYFAST_VALID_IPS
        
        assert PAYFAST_VALID_IPS is not None
        assert len(PAYFAST_VALID_IPS) > 0
    
    @pytest.mark.asyncio
    async def test_verify_itn_source_exists(self):
        """verify_itn_source function should exist."""
        from app.services.payfast_service import payfast_service
        
        assert hasattr(payfast_service, 'verify_itn_source')
        assert callable(payfast_service.verify_itn_source)
    
    @pytest.mark.asyncio
    async def test_verify_itn_source_rejects_random_ip(self):
        """verify_itn_source should reject random IPs."""
        from app.services.payfast_service import payfast_service
        
        result = await payfast_service.verify_itn_source("1.2.3.4")
        assert result is False
    
    @pytest.mark.asyncio
    async def test_verify_itn_source_accepts_valid_payfast_ip(self):
        """verify_itn_source should accept valid PayFast IPs."""
        from app.services.payfast_service import payfast_service, PAYFAST_VALID_IPS
        
        # Get first valid IP from the set
        valid_ip = next(iter(PAYFAST_VALID_IPS))
        result = await payfast_service.verify_itn_source(valid_ip)
        
        assert result is True


class TestAPIKeyValidation:
    """Tests for API key validation improvements."""
    
    @pytest.mark.asyncio
    async def test_validate_api_key_rejects_none(self):
        """API key validation should reject None."""
        from app.core.security import validate_api_key
        
        with pytest.raises(HTTPException) as exc_info:
            await validate_api_key(None)
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_validate_api_key_rejects_short_key(self):
        """API key validation should reject short keys."""
        from app.core.security import validate_api_key
        
        with pytest.raises(HTTPException) as exc_info:
            await validate_api_key("short")
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_validate_api_key_accepts_valid_format(self):
        """API key validation should accept valid format keys."""
        from app.core.security import validate_api_key
        
        # Valid format key (at least 16 chars)
        valid_key = "valid-api-key-with-sufficient-length"
        result = await validate_api_key(valid_key)
        
        assert result == valid_key


class TestSecurityHelpers:
    """Tests for security helper functions."""
    
    def test_generate_api_key_format(self):
        """Generated API keys should be URL-safe."""
        from app.core.security import generate_api_key
        
        key = generate_api_key()
        
        assert len(key) >= 32
        # URL-safe base64 chars only
        assert all(c.isalnum() or c in '-_' for c in key)
    
    def test_hash_api_key_consistent(self):
        """API key hashing should be consistent."""
        from app.core.security import hash_api_key
        
        key = "test-api-key-12345"
        hash1 = hash_api_key(key)
        hash2 = hash_api_key(key)
        
        assert hash1 == hash2
    
    def test_hash_api_key_different_keys(self):
        """Different keys should produce different hashes."""
        from app.core.security import hash_api_key
        
        hash1 = hash_api_key("key1")
        hash2 = hash_api_key("key2")
        
        assert hash1 != hash2
    
    def test_mask_key_hides_middle(self):
        """Key masking should hide middle portion."""
        from app.core.security import mask_key
        
        key = "csk-abcdefghijklmnopqrstuvwxyz"
        masked = mask_key(key)
        
        assert "..." in masked
        assert masked.startswith("csk-abcd")
        assert masked.endswith("wxyz")
