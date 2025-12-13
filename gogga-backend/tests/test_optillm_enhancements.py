"""
Tests for OptiLLM enhancement module.

Tests the configurable test-time compute optimizations.
"""
import pytest
from app.services.optillm_enhancements import (
    EnhancementLevel,
    EnhancementConfig,
    TIER_ENHANCEMENT_DEFAULTS,
    get_enhancement_config,
    enhance_system_prompt,
    enhance_user_message,
    should_use_planning,
    parse_enhanced_response,
    get_techniques_info,
    OPTILLM_TECHNIQUES_SUMMARY,
    COT_REFLECTION_INSTRUCTION,
    PLANNING_INSTRUCTION,
    REREAD_INSTRUCTION,
    SPL_REASONING_STRATEGIES,
)


class TestEnhancementConfig:
    """Tests for EnhancementConfig dataclass."""
    
    def test_default_config(self):
        """Test default enhancement config."""
        config = EnhancementConfig()
        assert config.level == EnhancementLevel.NONE
        assert config.use_cot_reflection is False
        assert config.use_reread is False
        assert config.use_planning is False
        assert config.use_self_consistency is False
        assert config.consistency_samples == 3
    
    def test_config_is_frozen(self):
        """Test that config is immutable."""
        config = EnhancementConfig()
        with pytest.raises(Exception):  # FrozenInstanceError
            config.level = EnhancementLevel.FULL


class TestTierDefaults:
    """Tests for tier-based enhancement defaults."""
    
    def test_free_tier_defaults(self):
        """FREE tier should have light enhancements."""
        config = TIER_ENHANCEMENT_DEFAULTS["free"]
        assert config.level == EnhancementLevel.LIGHT
        assert config.use_reread is True
        assert config.use_cot_reflection is False
        assert config.use_planning is False
    
    def test_jive_tier_defaults(self):
        """JIVE tier should have moderate enhancements."""
        config = TIER_ENHANCEMENT_DEFAULTS["jive"]
        assert config.level == EnhancementLevel.MODERATE
        assert config.use_reread is True
        assert config.use_cot_reflection is True
        assert config.use_planning is False
    
    def test_jigga_tier_defaults(self):
        """JIGGA tier should have full enhancements."""
        config = TIER_ENHANCEMENT_DEFAULTS["jigga"]
        assert config.level == EnhancementLevel.FULL
        assert config.use_reread is True
        assert config.use_cot_reflection is True
        assert config.use_planning is True


class TestGetEnhancementConfig:
    """Tests for get_enhancement_config function."""
    
    def test_free_tier_config(self):
        """Get config for FREE tier."""
        config = get_enhancement_config("free")
        assert config.level == EnhancementLevel.LIGHT
        assert config.use_reread is True
    
    def test_jive_tier_config(self):
        """Get config for JIVE tier."""
        config = get_enhancement_config("jive")
        assert config.level == EnhancementLevel.MODERATE
        assert config.use_cot_reflection is True
    
    def test_jigga_complex_upgrades_to_full(self):
        """JIGGA complex queries should get full enhancements."""
        config = get_enhancement_config("jigga", is_complex=True)
        assert config.level == EnhancementLevel.FULL
        assert config.use_planning is True
    
    def test_force_none_overrides_tier(self):
        """Force NONE should disable all enhancements."""
        config = get_enhancement_config(
            "jigga", 
            is_complex=True, 
            force_level=EnhancementLevel.NONE
        )
        assert config.level == EnhancementLevel.NONE
        assert config.use_reread is False
        assert config.use_cot_reflection is False
    
    def test_unknown_tier_defaults_to_free(self):
        """Unknown tier should default to FREE config."""
        config = get_enhancement_config("unknown_tier")
        assert config.level == EnhancementLevel.LIGHT


class TestEnhanceSystemPrompt:
    """Tests for enhance_system_prompt function."""
    
    def test_none_level_returns_unchanged(self):
        """NONE level should return prompt unchanged."""
        base = "You are a helpful assistant."
        config = EnhancementConfig(level=EnhancementLevel.NONE)
        result = enhance_system_prompt(base, config)
        assert result == base
    
    def test_light_adds_spl_strategies(self):
        """Light enhancements should add SPL reasoning strategies."""
        base = "You are a helpful assistant."
        config = EnhancementConfig(
            level=EnhancementLevel.LIGHT,
            use_reread=True
        )
        result = enhance_system_prompt(base, config)
        assert base in result
        assert "Apply these proven reasoning strategies" in result
    
    def test_moderate_adds_cot_reflection(self):
        """Moderate enhancements should add CoT reflection."""
        base = "You are a helpful assistant."
        config = EnhancementConfig(
            level=EnhancementLevel.MODERATE,
            use_cot_reflection=True
        )
        result = enhance_system_prompt(base, config)
        assert "<thinking>" in result
        assert "<reflection>" in result
        assert "<output>" in result
    
    def test_full_adds_planning(self):
        """Full enhancements should add planning mode."""
        base = "You are a helpful assistant."
        config = EnhancementConfig(
            level=EnhancementLevel.FULL,
            use_planning=True
        )
        result = enhance_system_prompt(base, config)
        assert "<plan>" in result
        assert "Break it into smaller sub-problems" in result


class TestEnhanceUserMessage:
    """Tests for enhance_user_message function."""
    
    def test_none_level_returns_unchanged(self):
        """NONE level should return message unchanged."""
        message = "What is Python?"
        config = EnhancementConfig(level=EnhancementLevel.NONE)
        result = enhance_user_message(message, config)
        assert result == message
    
    def test_reread_wraps_message(self):
        """Re-read should wrap message with emphasis."""
        message = "What is Python?"
        config = EnhancementConfig(
            level=EnhancementLevel.LIGHT,
            use_reread=True
        )
        result = enhance_user_message(message, config)
        assert "Read the question again carefully" in result
        assert message in result
        assert "Now answer the question above" in result


class TestShouldUsePlanning:
    """Tests for should_use_planning function."""
    
    def test_step_by_step_triggers_planning(self):
        """Step-by-step queries should trigger planning."""
        assert should_use_planning("explain this step by step") is True
    
    def test_system_design_triggers_planning(self):
        """System design queries should trigger planning."""
        assert should_use_planning("design a microservices architecture") is True
    
    def test_legal_triggers_planning(self):
        """Legal queries should trigger planning."""
        assert should_use_planning("what are the legal requirements?") is True
    
    def test_casual_chat_no_planning(self):
        """Casual chat should not trigger planning."""
        assert should_use_planning("hello how are you") is False
    
    def test_simple_question_no_planning(self):
        """Simple questions should not trigger planning."""
        assert should_use_planning("what is the capital of France?") is False


class TestParseEnhancedResponse:
    """Tests for parse_enhanced_response function."""
    
    def test_plain_text_returns_as_output(self):
        """Plain text without tags should be in output."""
        content = "The answer is 42."
        result = parse_enhanced_response(content)
        assert result["output"] == content
        assert result["thinking"] == ""
        assert result["reflection"] == ""
    
    def test_extracts_thinking_block(self):
        """Should extract <thinking> block."""
        content = "<thinking>Let me think about this...</thinking>The answer is 42."
        result = parse_enhanced_response(content)
        assert result["thinking"] == "Let me think about this..."
        assert "42" in result["output"]
    
    def test_extracts_reflection_block(self):
        """Should extract <reflection> block."""
        content = "<reflection>I should reconsider...</reflection>The answer is 42."
        result = parse_enhanced_response(content)
        assert result["reflection"] == "I should reconsider..."
    
    def test_extracts_plan_block(self):
        """Should extract <plan> block."""
        content = "<plan>1. First step\n2. Second step</plan>Executing plan..."
        result = parse_enhanced_response(content)
        assert "First step" in result["plan"]
        assert "Second step" in result["plan"]
    
    def test_extracts_output_block(self):
        """Should extract <output> block as main response."""
        content = "<thinking>...</thinking><output>Final answer here.</output>"
        result = parse_enhanced_response(content)
        assert result["output"] == "Final answer here."
    
    def test_handles_all_sections(self):
        """Should handle response with all sections."""
        content = """
<thinking>Analyzing the problem...</thinking>
<reflection>Looks correct.</reflection>
<output>The final answer is 42.</output>
"""
        result = parse_enhanced_response(content)
        assert "Analyzing" in result["thinking"]
        assert "correct" in result["reflection"]
        assert "42" in result["output"]


class TestTechniquesInfo:
    """Tests for techniques info functions."""
    
    def test_get_techniques_info_returns_list(self):
        """Should return list of technique info."""
        techniques = get_techniques_info()
        assert isinstance(techniques, list)
        assert len(techniques) > 0
    
    def test_each_technique_has_required_fields(self):
        """Each technique should have required fields."""
        techniques = get_techniques_info()
        required_fields = ["slug", "name", "description", "implemented"]
        for technique in techniques:
            for field in required_fields:
                assert field in technique, f"Missing {field} in {technique}"
    
    def test_implemented_techniques_present(self):
        """Should have implemented techniques marked."""
        techniques = get_techniques_info()
        implemented = [t for t in techniques if t["implemented"]]
        assert len(implemented) >= 4  # cot_reflection, re2, planning, spl


class TestInstructionConstants:
    """Tests for instruction constant content."""
    
    def test_cot_reflection_has_tags(self):
        """CoT reflection should include proper tags."""
        assert "<thinking>" in COT_REFLECTION_INSTRUCTION
        assert "<reflection>" in COT_REFLECTION_INSTRUCTION
        assert "<output>" in COT_REFLECTION_INSTRUCTION
    
    def test_planning_has_steps(self):
        """Planning instruction should include step structure."""
        assert "<plan>" in PLANNING_INSTRUCTION
        assert "sub-problems" in PLANNING_INSTRUCTION
    
    def test_reread_has_emphasis(self):
        """Re-read should emphasize careful reading."""
        assert "carefully" in REREAD_INSTRUCTION
    
    def test_spl_has_strategies(self):
        """SPL should include reasoning strategies."""
        assert "Clarification" in SPL_REASONING_STRATEGIES
        assert "Show Your Work" in SPL_REASONING_STRATEGIES


class TestOptillmTechniquesSummary:
    """Tests for the techniques summary dictionary."""
    
    def test_summary_contains_key_techniques(self):
        """Summary should contain key OptiLLM techniques."""
        expected_techniques = ["cot_reflection", "re2", "planning", "spl"]
        for tech in expected_techniques:
            assert tech in OPTILLM_TECHNIQUES_SUMMARY, f"Missing {tech}"
    
    def test_each_summary_has_accuracy_info(self):
        """Each technique should have accuracy improvement info."""
        for slug, info in OPTILLM_TECHNIQUES_SUMMARY.items():
            assert "accuracy_improvement" in info, f"Missing accuracy_improvement in {slug}"
            assert "token_overhead" in info, f"Missing token_overhead in {slug}"
    
    def test_implemented_flag_is_boolean(self):
        """Implemented flag should be boolean."""
        for slug, info in OPTILLM_TECHNIQUES_SUMMARY.items():
            assert isinstance(info["implemented"], bool), f"implemented not bool in {slug}"
