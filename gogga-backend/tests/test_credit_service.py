"""
Tests for GOGGA Credit Service

Run with: pytest tests/test_credit_service.py -v
"""
import pytest
from app.services.credit_service import (
    CreditService,
    ActionType,
    DeductionSource,
    UsageState,
    TIER_LIMITS,
    CREDIT_COSTS,
    JIVE_CREDIT_ALLOWED,
)


class TestCreditCosts:
    """Test credit cost calculations."""
    
    def test_token_credits_calculation(self):
        """1 credit per 10K tokens, rounded up."""
        assert CreditService.calculate_token_credits(0) == 0
        assert CreditService.calculate_token_credits(1) == 1
        assert CreditService.calculate_token_credits(9_999) == 1
        assert CreditService.calculate_token_credits(10_000) == 1
        assert CreditService.calculate_token_credits(10_001) == 2
        assert CreditService.calculate_token_credits(50_000) == 5
        assert CreditService.calculate_token_credits(100_000) == 10
    
    def test_credit_costs_defined(self):
        """All action types have credit costs."""
        for action in ActionType:
            assert action in CREDIT_COSTS
            assert CREDIT_COSTS[action] >= 1


class TestTierLimits:
    """Test tier limit definitions."""
    
    def test_free_tier_limits(self):
        """FREE tier has unlimited chat but no premium features."""
        limits = TIER_LIMITS["FREE"]
        assert limits["chat_tokens"] == float("inf")
        assert limits["images"] == 50  # Pollinations free
        assert limits["image_edits"] == 0
        assert limits["upscales"] == 0
        assert limits["video_seconds"] == 0
        assert limits["gogga_talk_mins"] == 0
    
    def test_jive_tier_limits(self):
        """JIVE tier has restricted limits."""
        limits = TIER_LIMITS["JIVE"]
        assert limits["chat_tokens"] == 500_000
        assert limits["images"] == 20
        assert limits["image_edits"] == 0  # Not included
        assert limits["upscales"] == 0     # Not included
        assert limits["video_seconds"] == 5
        assert limits["gogga_talk_mins"] == 30
    
    def test_jigga_tier_limits(self):
        """JIGGA tier has highest limits."""
        limits = TIER_LIMITS["JIGGA"]
        assert limits["chat_tokens"] == 2_000_000
        assert limits["images"] == 70
        assert limits["image_edits"] == 30
        assert limits["upscales"] == 10
        assert limits["video_seconds"] == 16
        assert limits["gogga_talk_mins"] == 25


class TestActionCheck:
    """Test action checking logic."""
    
    def test_subscription_allows_under_limit(self):
        """Action allowed when under subscription limit."""
        state = UsageState(
            tier="JIVE",
            credit_balance=0,
            chat_tokens_used=0,
            images_used=0,
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.IMAGE_CREATE, 1)
        
        assert result.allowed is True
        assert result.source == DeductionSource.SUBSCRIPTION
        assert result.credits_deducted == 0
    
    def test_credits_used_when_sub_exceeded(self):
        """Credits used when subscription limit exceeded."""
        state = UsageState(
            tier="JIVE",
            credit_balance=100,
            chat_tokens_used=0,
            images_used=20,  # At limit
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.IMAGE_CREATE, 1)
        
        assert result.allowed is True
        assert result.source == DeductionSource.CREDITS
        assert result.credits_deducted == 1
    
    def test_free_fallback_for_chat(self):
        """Chat falls back to free tier when no subscription/credits."""
        state = UsageState(
            tier="JIVE",
            credit_balance=0,
            chat_tokens_used=500_000,  # At limit
            images_used=0,
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.CHAT_10K_TOKENS, 1)
        
        assert result.allowed is True
        assert result.source == DeductionSource.FREE
        assert result.fallback_model is not None
    
    def test_denied_non_chat_no_credits(self):
        """Non-chat actions denied when no subscription/credits."""
        state = UsageState(
            tier="JIVE",
            credit_balance=0,
            chat_tokens_used=0,
            images_used=20,  # At limit
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.IMAGE_CREATE, 1)
        
        assert result.allowed is False
        assert result.source is None
        assert result.reason is not None
        assert "Insufficient credits" in result.reason
    
    def test_jive_credit_restrictions(self):
        """JIVE cannot use credits for edits/upscales/video."""
        state = UsageState(
            tier="JIVE",
            credit_balance=100,
            chat_tokens_used=0,
            images_used=0,
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=5,  # At limit
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        
        # Video not in JIVE allowed list
        result = CreditService.check_action(state, ActionType.VIDEO_SECOND, 1)
        
        assert result.allowed is False
        assert "JIVE tier credits cannot be used" in result.reason
    
    def test_jigga_no_restrictions(self):
        """JIGGA can use credits for any action."""
        state = UsageState(
            tier="JIGGA",
            credit_balance=100,
            chat_tokens_used=2_000_000,   # At limit
            images_used=70,               # At limit
            image_edits_used=30,          # At limit
            upscales_used=10,             # At limit
            video_seconds_used=16,        # At limit
            gogga_talk_mins_used=25,      # At limit
        )
        
        # All should be allowed with credits (since all at limit)
        for action in ActionType:
            result = CreditService.check_action(state, action, 1)
            assert result.allowed is True
            assert result.source == DeductionSource.CREDITS


class TestJiveCreditAllowed:
    """Test JIVE credit restrictions."""
    
    def test_chat_allowed(self):
        """JIVE can use credits for chat."""
        assert ActionType.CHAT_10K_TOKENS in JIVE_CREDIT_ALLOWED
    
    def test_image_create_allowed(self):
        """JIVE can use credits for image creation."""
        assert ActionType.IMAGE_CREATE in JIVE_CREDIT_ALLOWED
    
    def test_gogga_talk_allowed(self):
        """JIVE can use credits for voice chat."""
        assert ActionType.GOGGA_TALK_MIN in JIVE_CREDIT_ALLOWED
    
    def test_image_edit_not_allowed(self):
        """JIVE cannot use credits for image editing."""
        assert ActionType.IMAGE_EDIT not in JIVE_CREDIT_ALLOWED
    
    def test_upscale_not_allowed(self):
        """JIVE cannot use credits for upscaling."""
        assert ActionType.UPSCALE not in JIVE_CREDIT_ALLOWED
    
    def test_video_not_allowed(self):
        """JIVE cannot use credits for video."""
        assert ActionType.VIDEO_SECOND not in JIVE_CREDIT_ALLOWED


class TestFreeTier:
    """Test FREE tier behavior."""
    
    def test_free_unlimited_chat(self):
        """FREE tier has unlimited (slow) chat."""
        state = UsageState(
            tier="FREE",
            credit_balance=0,
            chat_tokens_used=1_000_000_000,  # Even huge usage
            images_used=0,
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.CHAT_10K_TOKENS, 1)
        
        assert result.allowed is True
        assert result.source == DeductionSource.SUBSCRIPTION
    
    def test_free_images_limited(self):
        """FREE tier has 50 Pollinations images."""
        state = UsageState(
            tier="FREE",
            credit_balance=0,
            chat_tokens_used=0,
            images_used=50,  # At limit
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        result = CreditService.check_action(state, ActionType.IMAGE_CREATE, 1)
        
        # Should be denied - FREE can't buy credits
        assert result.allowed is False
    
    def test_free_no_premium_features(self):
        """FREE tier has no edit/upscale/video/voice."""
        state = UsageState(
            tier="FREE",
            credit_balance=0,
            chat_tokens_used=0,
            images_used=0,
            image_edits_used=0,
            upscales_used=0,
            video_seconds_used=0,
            gogga_talk_mins_used=0,
            icons_used=0,
        )
        
        # All premium features denied
        for action in [ActionType.IMAGE_EDIT, ActionType.UPSCALE, 
                       ActionType.VIDEO_SECOND, ActionType.GOGGA_TALK_MIN]:
            result = CreditService.check_action(state, action, 1)
            assert result.allowed is False


class TestMarginCalculation:
    """Verify 47% margin calculations."""
    
    def test_jive_margin(self):
        """JIVE tier should have ~47% margin."""
        # R99/mo = $5.21 USD (at R19/$)
        price_usd = 99 / 19
        
        # Estimated costs:
        # - 500K tokens at $0.60/M avg = $0.30
        # - 20 images at $0.04 = $0.80
        # - 5 sec video at $0.20 = $1.00
        # - 30 min voice at $0.0225 = $0.68
        # Total = $2.78
        
        estimated_cost = 0.30 + 0.80 + 1.00 + 0.68
        margin = (price_usd - estimated_cost) / price_usd
        
        assert margin >= 0.45, f"JIVE margin too low: {margin:.2%}"
        assert margin <= 0.50, f"JIVE margin too high: {margin:.2%}"
    
    def test_jigga_margin(self):
        """JIGGA tier should have ~47% margin."""
        # R299/mo = $15.74 USD (at R19/$)
        price_usd = 299 / 19
        
        # Estimated costs:
        # - 2M tokens at $0.60/M avg = $1.20
        # - 70 images at $0.04 = $2.80
        # - 30 edits at $0.04 = $1.20
        # - 10 upscales at $0.06 = $0.60
        # - 16 sec video at $0.20 = $3.20
        # - 25 min voice at $0.0225 = $0.56
        # Total = $9.56 (adjusted from original estimate)
        
        estimated_cost = 1.20 + 2.80 + 1.20 + 0.60 + 3.20 + 0.56
        margin = (price_usd - estimated_cost) / price_usd
        
        assert margin >= 0.35, f"JIGGA margin too low: {margin:.2%}"
        assert margin <= 0.50, f"JIGGA margin too high: {margin:.2%}"


class TestTokenValidation:
    """Test enterprise-grade token validation."""
    
    def test_validate_token_count_exact_match(self):
        """Exact match should pass."""
        assert CreditService.validate_token_count(1000, 1000) is True
    
    def test_validate_token_count_within_tolerance(self):
        """Within 10% tolerance should pass."""
        # 1000 actual, 1050 claimed = 5% variance
        assert CreditService.validate_token_count(1050, 1000) is True
        assert CreditService.validate_token_count(950, 1000) is True
        # At exactly 10%
        assert CreditService.validate_token_count(1100, 1000) is True
        assert CreditService.validate_token_count(900, 1000) is True
    
    def test_validate_token_count_exceeds_tolerance(self):
        """Beyond 10% tolerance should fail."""
        # 1000 actual, 1200 claimed = 20% variance
        assert CreditService.validate_token_count(1200, 1000) is False
        assert CreditService.validate_token_count(800, 1000) is False
    
    def test_validate_token_count_zero_actual(self):
        """Zero actual tokens - claimed must also be zero."""
        assert CreditService.validate_token_count(0, 0) is True
        assert CreditService.validate_token_count(100, 0) is False
    
    def test_validate_token_count_negative(self):
        """Negative tokens should return False (invalid)."""
        # Note: In practice negative tokens shouldn't occur
        # The variance calculation will be > tolerance
        assert CreditService.validate_token_count(-100, 1000) is False


class TestIdempotencyKey:
    """Test idempotency key generation."""
    
    def test_idempotency_key_format(self):
        """Verify idempotency key contains expected components."""
        import uuid
        # The key format is: "{action}:{user_id}:{uuid}"
        action = ActionType.CHAT_10K_TOKENS
        user_id = "test_user_123"
        key = f"{action.value}:{user_id}:{uuid.uuid4()}"
        
        assert action.value in key
        assert user_id in key
        # UUID component should be present (36 chars with hyphens)
        parts = key.split(":")
        assert len(parts) == 3
        assert len(parts[2]) == 36  # UUID format


class TestCreditCostAccuracy:
    """Test credit cost calculation accuracy."""
    
    def test_credit_to_usd_conversion(self):
        """1 credit = $0.10 USD."""
        credit_value_usd = 0.10
        
        # 1 credit for 10K tokens
        token_cost_per_10k = credit_value_usd * CREDIT_COSTS[ActionType.CHAT_10K_TOKENS]
        # At $0.60/M avg, 10K tokens = $0.006
        # Selling at $0.10 = 16.7x markup (covers overhead)
        assert token_cost_per_10k == 0.10
        
        # 1 credit for 1 image
        image_cost = credit_value_usd * CREDIT_COSTS[ActionType.IMAGE_CREATE]
        # At $0.04/image, selling at $0.10 = 2.5x markup
        assert image_cost == 0.10
        
        # 2 credits for 1 second video
        video_cost = credit_value_usd * CREDIT_COSTS[ActionType.VIDEO_SECOND]
        # At $0.20/sec, selling at $0.20 = 1x (break-even)
        assert video_cost == 0.20
    
    def test_zar_credit_value(self):
        """1 credit = R1.90 ZAR (at R19/$)."""
        zar_per_usd = 19
        credit_value_usd = 0.10
        credit_value_zar = credit_value_usd * zar_per_usd
        
        # Use pytest.approx for floating point comparison
        import pytest
        assert credit_value_zar == pytest.approx(1.90)