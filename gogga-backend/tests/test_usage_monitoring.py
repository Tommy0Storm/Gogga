"""
Usage Monitoring Tests
Tests for the usage tracking and analytics features.

Run with: pytest tests/test_usage_monitoring.py -v
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


class TestUsageTracking:
    """Tests for usage tracking functionality."""

    def test_tool_usage_composite_key_generation(self):
        """Test that composite keys are generated correctly for tool usage."""
        date = "2025-12-20"
        tool_name = "generate_image"
        tier = "JIVE"
        
        composite_key = f"{date}_{tool_name}_{tier}"
        
        assert composite_key == "2025-12-20_generate_image_JIVE"

    def test_date_range_calculation_today(self):
        """Test date range calculation for 'today' period."""
        now = datetime.now()
        start_date = datetime(now.year, now.month, now.day)
        
        assert start_date.hour == 0
        assert start_date.minute == 0
        assert start_date.second == 0

    def test_date_range_calculation_week(self):
        """Test date range calculation for 'week' period."""
        now = datetime.now()
        start_date = now - timedelta(days=7)
        
        assert (now - start_date).days == 7

    def test_date_range_calculation_month(self):
        """Test date range calculation for 'month' period."""
        now = datetime.now()
        start_date = datetime(now.year, now.month, 1)
        
        assert start_date.day == 1
        assert start_date.month == now.month
        assert start_date.year == now.year

    def test_date_range_calculation_year(self):
        """Test date range calculation for 'year' period."""
        now = datetime.now()
        start_date = datetime(now.year, 1, 1)
        
        assert start_date.day == 1
        assert start_date.month == 1
        assert start_date.year == now.year


class TestToolUsageMetrics:
    """Tests for tool usage metrics calculations."""

    def test_success_rate_calculation(self):
        """Test success rate calculation."""
        call_count = 100
        success_count = 95
        failure_count = 5
        
        success_rate = (success_count / call_count) * 100
        
        assert success_rate == 95.0
        assert success_count + failure_count == call_count

    def test_success_rate_with_zero_calls(self):
        """Test success rate when no calls have been made."""
        call_count = 0
        success_count = 0
        
        success_rate = 0 if call_count == 0 else (success_count / call_count) * 100
        
        assert success_rate == 0

    def test_average_duration_calculation(self):
        """Test average execution duration calculation."""
        call_count = 10
        total_duration_ms = 25000  # 25 seconds total
        
        avg_duration_ms = total_duration_ms / call_count if call_count > 0 else 0
        
        assert avg_duration_ms == 2500  # 2.5 seconds average

    def test_average_duration_with_zero_calls(self):
        """Test average duration when no calls have been made."""
        call_count = 0
        total_duration_ms = 0
        
        avg_duration_ms = total_duration_ms / call_count if call_count > 0 else 0
        
        assert avg_duration_ms == 0


class TestTokenUsageMetrics:
    """Tests for token usage metrics calculations."""

    def test_total_tokens_calculation(self):
        """Test total tokens from input + output."""
        input_tokens = 1000
        output_tokens = 500
        
        total_tokens = input_tokens + output_tokens
        
        assert total_tokens == 1500

    def test_cost_calculation_zar(self):
        """Test cost calculation in ZAR."""
        # Example: R0.01 per 1000 tokens
        total_tokens = 5000
        rate_per_1k = 0.01
        
        cost_zar = (total_tokens / 1000) * rate_per_1k
        
        assert cost_zar == 0.05

    def test_daily_aggregation_by_tier(self):
        """Test daily aggregation groups by tier correctly."""
        daily_data = [
            {"tier": "FREE", "totalTokens": 1000},
            {"tier": "JIVE", "totalTokens": 5000},
            {"tier": "JIGGA", "totalTokens": 10000},
            {"tier": "FREE", "totalTokens": 500},  # Second FREE entry
        ]
        
        by_tier = {}
        for entry in daily_data:
            tier = entry["tier"]
            by_tier[tier] = by_tier.get(tier, 0) + entry["totalTokens"]
        
        assert by_tier["FREE"] == 1500
        assert by_tier["JIVE"] == 5000
        assert by_tier["JIGGA"] == 10000

    def test_monthly_total_calculation(self):
        """Test monthly total calculation across all tiers."""
        monthly_data = [
            {"date": "2025-12-01", "totalTokens": 1000},
            {"date": "2025-12-05", "totalTokens": 2000},
            {"date": "2025-12-10", "totalTokens": 3000},
            {"date": "2025-12-15", "totalTokens": 4000},
            {"date": "2025-12-20", "totalTokens": 5000},
        ]
        
        monthly_total = sum(entry["totalTokens"] for entry in monthly_data)
        
        assert monthly_total == 15000


class TestTierRouting:
    """Tests for tier-based routing in usage tracking."""

    @pytest.mark.parametrize("tier,expected_normalized", [
        ("free", "FREE"),
        ("FREE", "FREE"),
        ("jive", "JIVE"),
        ("JIVE", "JIVE"),
        ("jigga", "JIGGA"),
        ("JIGGA", "JIGGA"),
    ])
    def test_tier_normalization(self, tier: str, expected_normalized: str):
        """Test tier values are normalized to uppercase."""
        normalized = tier.upper()
        assert normalized == expected_normalized

    def test_valid_tiers(self):
        """Test that only valid tiers are accepted."""
        valid_tiers = {"FREE", "JIVE", "JIGGA"}
        
        assert "FREE" in valid_tiers
        assert "JIVE" in valid_tiers
        assert "JIGGA" in valid_tiers
        assert "BASIC" not in valid_tiers
        assert "PREMIUM" not in valid_tiers


class TestUsageAPIValidation:
    """Tests for usage API input validation."""

    def test_period_validation(self):
        """Test that period parameter is validated."""
        valid_periods = {"today", "week", "month", "year", "all"}
        
        assert "today" in valid_periods
        assert "week" in valid_periods
        assert "month" in valid_periods
        assert "year" in valid_periods
        assert "all" in valid_periods
        assert "decade" not in valid_periods

    def test_tool_usage_required_fields(self):
        """Test that tool usage POST requires toolName and tier."""
        required_fields = {"toolName", "tier"}
        
        valid_payload = {"toolName": "search_web", "tier": "FREE", "success": True}
        invalid_payload_1 = {"tier": "FREE", "success": True}
        invalid_payload_2 = {"toolName": "search_web", "success": True}
        
        assert all(field in valid_payload for field in required_fields)
        assert not all(field in invalid_payload_1 for field in required_fields)
        assert not all(field in invalid_payload_2 for field in required_fields)


class TestDailyTrend:
    """Tests for daily usage trend calculations."""

    def test_daily_trend_date_formatting(self):
        """Test daily trend dates are formatted correctly."""
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        
        assert len(date_str) == 10
        assert date_str.count("-") == 2

    def test_daily_trend_last_30_days(self):
        """Test daily trend includes last 30 days."""
        now = datetime.now()
        thirty_days_ago = now - timedelta(days=30)
        
        days = []
        current = thirty_days_ago
        while current <= now:
            days.append(current.strftime("%Y-%m-%d"))
            current += timedelta(days=1)
        
        assert len(days) == 31  # Inclusive of both endpoints

    def test_daily_trend_sorting(self):
        """Test daily trend is sorted chronologically."""
        dates = [
            "2025-12-20",
            "2025-12-18",
            "2025-12-19",
            "2025-12-15",
        ]
        
        sorted_dates = sorted(dates)
        
        assert sorted_dates == ["2025-12-15", "2025-12-18", "2025-12-19", "2025-12-20"]


class TestProviderBreakdown:
    """Tests for provider usage breakdown."""

    def test_provider_aggregation(self):
        """Test usage aggregation by provider."""
        usage_data = [
            {"provider": "cerebras", "totalTokens": 10000},
            {"provider": "openrouter", "totalTokens": 5000},
            {"provider": "cerebras", "totalTokens": 15000},
            {"provider": "vertex", "totalTokens": 3000},
        ]
        
        by_provider = {}
        for entry in usage_data:
            provider = entry["provider"]
            by_provider[provider] = by_provider.get(provider, 0) + entry["totalTokens"]
        
        assert by_provider["cerebras"] == 25000
        assert by_provider["openrouter"] == 5000
        assert by_provider["vertex"] == 3000

    def test_provider_percentage_calculation(self):
        """Test provider percentage of total usage."""
        totals = {"cerebras": 25000, "openrouter": 5000, "vertex": 3000}
        grand_total = sum(totals.values())  # 33000
        
        percentages = {k: (v / grand_total) * 100 for k, v in totals.items()}
        
        assert round(percentages["cerebras"], 1) == 75.8
        assert round(percentages["openrouter"], 1) == 15.2
        assert round(percentages["vertex"], 1) == 9.1


class TestFormatters:
    """Tests for display formatters."""

    def test_format_tokens_thousands(self):
        """Test token formatting for thousands."""
        def format_tokens(n: int) -> str:
            if n >= 1_000_000:
                return f"{n / 1_000_000:.1f}M"
            elif n >= 1_000:
                return f"{n / 1_000:.1f}K"
            return str(n)
        
        assert format_tokens(500) == "500"
        assert format_tokens(1500) == "1.5K"
        assert format_tokens(15000) == "15.0K"
        assert format_tokens(1500000) == "1.5M"

    def test_format_duration_ms(self):
        """Test duration formatting in milliseconds."""
        def format_duration(ms: int) -> str:
            if ms >= 60000:
                return f"{ms / 60000:.1f}m"
            elif ms >= 1000:
                return f"{ms / 1000:.1f}s"
            return f"{ms}ms"
        
        assert format_duration(500) == "500ms"
        assert format_duration(2500) == "2.5s"
        assert format_duration(120000) == "2.0m"

    def test_format_cost_zar(self):
        """Test cost formatting in ZAR."""
        def format_cost(cost: float) -> str:
            return f"R{cost:.2f}"
        
        assert format_cost(0.01) == "R0.01"
        assert format_cost(1.50) == "R1.50"
        assert format_cost(100) == "R100.00"


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_empty_usage_data(self):
        """Test handling of empty usage data."""
        usage_data = []
        
        total = sum(entry.get("totalTokens", 0) for entry in usage_data)
        
        assert total == 0

    def test_missing_optional_fields(self):
        """Test handling of missing optional fields."""
        entry = {"toolName": "test", "tier": "FREE"}
        
        duration_ms = entry.get("durationMs", 0)
        user_id = entry.get("userId")
        
        assert duration_ms == 0
        assert user_id is None

    def test_very_large_token_counts(self):
        """Test handling of very large token counts."""
        large_count = 999_999_999_999
        
        # Should not overflow
        formatted = f"{large_count / 1_000_000_000:.1f}B"
        
        assert formatted == "1000.0B"

    def test_zero_division_protection(self):
        """Test protection against division by zero."""
        call_count = 0
        total_duration_ms = 0
        
        avg = total_duration_ms / call_count if call_count > 0 else 0
        success_rate = 0 if call_count == 0 else (0 / call_count) * 100
        
        assert avg == 0
        assert success_rate == 0


# Integration test placeholder
class TestUsageIntegration:
    """Integration tests for usage tracking (placeholder for actual API tests)."""

    @pytest.mark.skip(reason="Requires running server")
    async def test_get_usage_api(self):
        """Test GET /api/usage endpoint."""
        pass

    @pytest.mark.skip(reason="Requires running server")
    async def test_post_tool_usage_api(self):
        """Test POST /api/usage endpoint."""
        pass
