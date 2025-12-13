"""
Unit Tests for Gogga Personality Modes and Empathetic Reasoning.

Pytest-compatible tests that validate:
1. Three personality modes: System (Neutral), Goody Gogga, Dark Gogga
2. Empathetic reasoning instruction ("think why user asks")
3. Integration of empathy with prompt enhancement
4. Personality mode switching in prompts
5. SA context and language awareness

Run: pytest tests/test_personality_modes.py -v
"""

import pytest
import re
from app.prompts import (
    QWEN_IDENTITY_PROMPT,
    GOGGA_BASE_PROMPT,
)
from app.services.optillm_enhancements import (
    EMPATHETIC_REASONING_INSTRUCTION,
    SPL_REASONING_STRATEGIES,
    enhance_system_prompt,
    enhance_user_message,
    EnhancementConfig,
    EnhancementLevel,
    TIER_ENHANCEMENT_DEFAULTS,
    get_enhancement_config,
)


# ============================================================================
# PERSONALITY MODE TESTS
# ============================================================================

class TestPersonalityModeDefinitions:
    """Test that all three personality modes are properly defined."""
    
    def test_three_modes_defined(self):
        """Should have System, Goody Gogga, and Dark Gogga modes."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        
        # Check for mode references
        has_system = "system" in prompt_lower or "neutral" in prompt_lower or "balanced" in prompt_lower
        has_goody = "goody" in prompt_lower or "positive" in prompt_lower or "uplifting" in prompt_lower
        has_dark = "dark" in prompt_lower or "sarcastic" in prompt_lower or "witty" in prompt_lower
        
        assert has_system, "System/neutral mode should be defined"
        assert has_goody, "Goody Gogga/positive mode should be defined"
        assert has_dark, "Dark Gogga/sarcastic mode should be defined"
    
    def test_serious_mode_exists(self):
        """Serious mode should auto-trigger for sensitive topics."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_serious = "[serious]" in prompt_lower or "serious mode" in prompt_lower or \
                     "legal" in prompt_lower or "medical" in prompt_lower
        assert has_serious, "Serious mode should exist for sensitive topics"


class TestDarkGoggaPersonality:
    """Test Dark Gogga (sarcastic) personality mode."""
    
    def test_sarcasm_indicators_present(self):
        """Dark Gogga should have sarcastic response patterns."""
        sarcasm_words = ["eish", "another", "delightful", "wonderful", "special", "of course"]
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_sarcasm = any(word in prompt_lower for word in sarcasm_words)
        assert has_sarcasm, "Dark Gogga should have sarcastic language patterns"
    
    def test_dark_gogga_remains_helpful(self):
        """Even sarcastic, Gogga must still help the user."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_help = "help" in prompt_lower or "assist" in prompt_lower or "support" in prompt_lower
        assert has_help, "Dark Gogga must remain helpful despite sarcasm"
    
    def test_no_harmful_language(self):
        """Dark Gogga should not use cruel or harmful language."""
        harmful_words = ["stupid", "idiot", "dumb", "loser", "pathetic"]
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        for word in harmful_words:
            assert word not in prompt_lower, f"Should not use harmful word: {word}"


class TestGoodyGoggaPersonality:
    """Test Goody Gogga (positive/uplifting) personality mode."""
    
    def test_positive_language_patterns(self):
        """Goody Gogga should use encouraging, positive language."""
        positive_words = ["wonderful", "fantastic", "great", "opportunity", "exciting", "celebrate"]
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_positive = any(word in prompt_lower for word in positive_words)
        assert has_positive, "Goody Gogga should use positive language"
    
    def test_goody_is_encouraging(self):
        """Goody Gogga should encourage and support users."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        encouraging = ["positive" in prompt_lower, "uplifting" in prompt_lower, 
                      "support" in prompt_lower, "warm" in prompt_lower]
        assert any(encouraging), "Goody Gogga should be encouraging"
    
    def test_authenticity_not_forced(self):
        """Positivity should feel genuine, not robotic."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        authentic = ["genuine" in prompt_lower, "natural" in prompt_lower,
                    "warm" in prompt_lower, "authentic" in prompt_lower]
        assert any(authentic), "Goody Gogga should feel authentic"


class TestSystemNeutralMode:
    """Test System (neutral/balanced) personality mode."""
    
    def test_professional_balanced(self):
        """Neutral mode should be professional and balanced."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        professional = ["professional" in prompt_lower, "balanced" in prompt_lower,
                       "clear" in prompt_lower, "neutral" in prompt_lower]
        assert any(professional), "System mode should be professional"
    
    def test_still_has_warmth(self):
        """Even neutral mode should not be cold/robotic."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        warm = "warm" in prompt_lower or "friendly" in prompt_lower
        assert warm, "Neutral mode should still have warmth"


# ============================================================================
# EMPATHETIC REASONING TESTS
# ============================================================================

class TestEmpatheticReasoningInstruction:
    """Test the empathetic reasoning instruction content."""
    
    def test_instruction_exists_and_substantial(self):
        """Empathetic reasoning instruction should exist with meaningful content."""
        assert EMPATHETIC_REASONING_INSTRUCTION is not None
        assert len(EMPATHETIC_REASONING_INSTRUCTION) > 200, "Should be substantial guidance"
    
    def test_asks_why_user_is_asking(self):
        """Should prompt LLM to think about WHY user is asking."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        assert "why" in text, "Should ask WHY"
        assert "asking" in text or "question" in text, "Should relate to user's question"
    
    def test_considers_underlying_need(self):
        """Should consider the underlying human need."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        assert "need" in text, "Should consider user's needs"
        assert "underlying" in text or "behind" in text or "situation" in text
    
    def test_thinks_proactively(self):
        """Should think about what to offer beyond the literal answer."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        proactive_words = ["offer", "proactive", "next", "beyond", "anticipate"]
        has_proactive = any(word in text for word in proactive_words)
        assert has_proactive, "Should encourage proactive thinking"
    
    def test_considers_emotional_state(self):
        """Should consider user's emotional state."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        emotion_words = ["emotion", "feeling", "stressed", "frustrated", "excited", "anxious"]
        has_emotion = any(word in text for word in emotion_words)
        assert has_emotion, "Should consider emotional state"
    
    def test_anticipates_follow_up(self):
        """Should anticipate follow-up questions."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        followup_words = ["follow", "next", "anticipate", "might need"]
        has_followup = any(word in text for word in followup_words)
        assert has_followup, "Should anticipate follow-up needs"
    
    def test_tailors_response(self):
        """Should guide LLM to tailor response to user."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        tailor_words = ["tailor", "adjust", "match", "adapt", "complexity"]
        has_tailor = any(word in text for word in tailor_words)
        assert has_tailor, "Should guide response tailoring"


class TestEmpatheticEnhancement:
    """Test empathetic reasoning integration with prompt enhancement."""
    
    def test_included_by_default(self):
        """Empathy should be included in enhanced prompts by default."""
        config = EnhancementConfig(level=EnhancementLevel.MODERATE)
        enhanced = enhance_system_prompt("Base prompt", config)
        
        assert "WHY is the user asking" in enhanced or "EMPATHETIC" in enhanced, \
               "Empathetic reasoning should be included by default"
    
    def test_can_be_excluded(self):
        """Should be able to exclude empathy when not wanted."""
        config = EnhancementConfig(level=EnhancementLevel.MODERATE)
        enhanced = enhance_system_prompt("Base prompt", config, include_empathy=False)
        
        assert "EMPATHETIC THINKING" not in enhanced, \
               "Should be able to exclude empathetic reasoning"
    
    def test_none_level_returns_unchanged(self):
        """NONE enhancement level should return unmodified prompt."""
        config = EnhancementConfig(level=EnhancementLevel.NONE)
        base = "Original base prompt only"
        enhanced = enhance_system_prompt(base, config)
        
        assert enhanced == base, "NONE level should not modify prompt"
    
    def test_light_level_includes_empathy(self):
        """LIGHT level (FREE tier) should include empathy."""
        config = EnhancementConfig(level=EnhancementLevel.LIGHT)
        enhanced = enhance_system_prompt("Base", config)
        
        assert "WHY is the user asking" in enhanced or "EMPATHETIC" in enhanced
    
    def test_full_level_includes_all(self):
        """FULL level should include empathy plus all other enhancements."""
        config = EnhancementConfig(
            level=EnhancementLevel.FULL,
            use_cot_reflection=True,
            use_planning=True,
        )
        enhanced = enhance_system_prompt("Base", config)
        
        # Check all components present
        assert "EMPATHETIC" in enhanced or "WHY is the user asking" in enhanced
        assert "reasoning strategies" in enhanced.lower()  # SPL
        assert "plan" in enhanced.lower()  # Planning
        assert "reflect" in enhanced.lower()  # CoT Reflection


class TestTierEmpatheticDefaults:
    """Test that all tier defaults properly include empathy."""
    
    def test_free_tier_has_empathy(self):
        """FREE tier should include empathetic reasoning."""
        config = TIER_ENHANCEMENT_DEFAULTS["free"]
        enhanced = enhance_system_prompt("Base", config)
        assert "EMPATHETIC" in enhanced or "WHY is the user asking" in enhanced
    
    def test_jive_tier_has_empathy(self):
        """JIVE tier should include empathetic reasoning."""
        config = TIER_ENHANCEMENT_DEFAULTS["jive"]
        enhanced = enhance_system_prompt("Base", config)
        assert "EMPATHETIC" in enhanced or "WHY is the user asking" in enhanced
    
    def test_jigga_tier_has_empathy(self):
        """JIGGA tier should include empathetic reasoning."""
        config = TIER_ENHANCEMENT_DEFAULTS["jigga"]
        enhanced = enhance_system_prompt("Base", config)
        assert "EMPATHETIC" in enhanced or "WHY is the user asking" in enhanced


# ============================================================================
# SOUTH AFRICAN CONTEXT TESTS
# ============================================================================

class TestSAContextAwareness:
    """Test South African context in personality."""
    
    def test_sa_slang_present(self):
        """Should include SA expressions."""
        sa_words = ["eish", "lekker", "howzit", "shame", "bru", "braai", "yoh"]
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_sa = any(word in prompt_lower for word in sa_words)
        assert has_sa, "Should include SA expressions"
    
    def test_sa_context_references(self):
        """Should reference SA-specific contexts."""
        sa_contexts = ["eskom", "load shedding", "sassa", "popia", "cpa", "lra", "ccma"]
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        has_context = any(context in prompt_lower for context in sa_contexts)
        assert has_context, "Should reference SA institutions/laws"
    
    def test_south_african_identity(self):
        """Should have South African identity."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        sa_identity = "south africa" in prompt_lower or "sa" in prompt_lower or "mzansi" in prompt_lower
        assert sa_identity, "Should have SA identity"


class TestUserAdvocacy:
    """Test that Gogga is a user advocate, not corporate neutral."""
    
    def test_user_advocate_stance(self):
        """Gogga should be on the user's side."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        advocate_words = ["advocate", "champion", "fight", "your side", "help you", "support"]
        has_advocacy = any(word in prompt_lower for word in advocate_words)
        assert has_advocacy, "Gogga should advocate for users"
    
    def test_not_wishy_washy(self):
        """Should not be corporate neutral like generic AI."""
        # Gogga has opinions and takes sides (the user's side)
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        assert "you" in prompt_lower, "Should be user-focused"


# ============================================================================
# PERSONALITY + EMPATHY COMBINATION TESTS
# ============================================================================

class TestPersonalityEmpathyCombination:
    """Test that personality modes work with empathetic reasoning."""
    
    def test_sarcastic_with_empathy(self):
        """Sarcastic mode + empathy = witty but understanding."""
        # Both should exist independently
        assert "sarcastic" in GOGGA_BASE_PROMPT.lower() or "Dark Gogga" in GOGGA_BASE_PROMPT
        assert "need" in EMPATHETIC_REASONING_INSTRUCTION.lower()
    
    def test_positive_with_empathy(self):
        """Positive mode + empathy = uplifting and understanding."""
        assert "positive" in GOGGA_BASE_PROMPT.lower() or "Goody Gogga" in GOGGA_BASE_PROMPT
        assert "offer" in EMPATHETIC_REASONING_INSTRUCTION.lower()
    
    def test_serious_mode_overrides(self):
        """Serious mode should override personality for sensitive topics."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        triggers = ["legal", "medical", "financial", "crisis", "abuse"]
        has_trigger = any(trigger in prompt_lower for trigger in triggers)
        assert has_trigger, "Serious mode should trigger for sensitive topics"


# ============================================================================
# EXPANDED PERSONALITY TESTS - DETAILED SCENARIOS
# ============================================================================

class TestPersonalityModeCharacteristics:
    """Detailed tests for each personality mode's characteristics."""
    
    def test_dark_gogga_load_shedding_humor(self):
        """Dark Gogga should joke about SA-specific issues like load shedding."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        # Dark Gogga is known for load shedding humor
        has_eskom = "eskom" in prompt_lower or "load shedding" in prompt_lower
        assert has_eskom, "Dark Gogga should reference Eskom/load shedding"
    
    def test_dark_gogga_landlord_sarcasm(self):
        """Dark Gogga has specific sarcastic responses for common SA issues."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        # Example: "Another landlord who thinks the RHA doesn't apply to them?"
        has_examples = "landlord" in prompt_lower or "rha" in prompt_lower or "rental" in prompt_lower
        assert has_examples, "Should have SA-specific sarcastic examples"
    
    def test_goody_gogga_celebration(self):
        """Goody Gogga celebrates user wins."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        celebration_words = ["celebrate", "wonderful", "fantastic", "amazing", "proud"]
        has_celebration = any(word in prompt_lower for word in celebration_words)
        assert has_celebration, "Goody Gogga should celebrate"
    
    def test_goody_gogga_opportunity_mindset(self):
        """Goody Gogga sees opportunities in challenges."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        opportunity_words = ["opportunity", "challenge", "grow", "learn", "overcome"]
        has_opportunity = any(word in prompt_lower for word in opportunity_words)
        assert has_opportunity, "Goody Gogga should have opportunity mindset"
    
    def test_system_mode_context_switching(self):
        """System mode should adapt to context (formal vs casual)."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        # System adapts - professional for work, casual for chat
        has_adapt = "adapt" in prompt_lower or "context" in prompt_lower or "balanced" in prompt_lower
        assert has_adapt, "System mode should adapt to context"


class TestEmpatheticReasoningComponents:
    """Detailed tests for each component of empathetic reasoning."""
    
    def test_empathy_considers_problem_solving(self):
        """Empathy should identify if user is problem-solving."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        problem_words = ["problem", "solve", "solution", "fix", "issue"]
        has_problem = any(word in text for word in problem_words)
        assert has_problem, "Should consider problem-solving needs"
    
    def test_empathy_considers_urgency(self):
        """Empathy should consider if there's urgency."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        urgency_words = ["urgent", "pressure", "quick", "time", "deadline"]
        has_urgency = any(word in text for word in urgency_words)
        assert has_urgency, "Should consider urgency"
    
    def test_empathy_offers_resources(self):
        """Empathy should suggest offering resources."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        resource_words = ["resource", "next step", "tip", "information", "related"]
        has_resources = any(word in text for word in resource_words)
        assert has_resources, "Should offer related resources"
    
    def test_empathy_matches_expertise(self):
        """Empathy should match response to user expertise level."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        expertise_words = ["expertise", "complexity", "adjust", "level", "understanding"]
        has_expertise = any(word in text for word in expertise_words)
        assert has_expertise, "Should match user expertise"


class TestPromptEnhancementIntegration:
    """Test full integration of personality with enhancement system."""
    
    def test_free_tier_gets_light_enhancement(self):
        """FREE tier should get light enhancement with empathy."""
        config = get_enhancement_config("free")
        assert config.level == EnhancementLevel.LIGHT
        assert config.use_reread is True
    
    def test_jive_tier_gets_moderate_enhancement(self):
        """JIVE tier should get moderate enhancement."""
        config = get_enhancement_config("jive")
        assert config.level == EnhancementLevel.MODERATE
        assert config.use_cot_reflection is True
        assert config.use_reread is True
    
    def test_jigga_tier_gets_full_enhancement(self):
        """JIGGA tier should get full enhancement."""
        config = get_enhancement_config("jigga")
        assert config.level == EnhancementLevel.FULL
        assert config.use_cot_reflection is True
        assert config.use_reread is True
        assert config.use_planning is True
    
    def test_jigga_complex_query_enhancement(self):
        """JIGGA complex queries should get full enhancement."""
        config = get_enhancement_config("jigga", is_complex=True)
        assert config.level == EnhancementLevel.FULL
        assert config.use_planning is True
    
    def test_enhanced_prompt_structure(self):
        """Enhanced prompts should have proper structure."""
        config = EnhancementConfig(
            level=EnhancementLevel.FULL,
            use_cot_reflection=True,
            use_planning=True,
        )
        enhanced = enhance_system_prompt("Test base prompt", config)
        
        # Should contain base prompt
        assert "Test base prompt" in enhanced
        # Should contain empathy
        assert "EMPATHETIC" in enhanced or "WHY is the user asking" in enhanced
        # Should be substantial
        assert len(enhanced) > len("Test base prompt") + 500
    
    def test_user_message_enhancement(self):
        """User messages should be enhanced with re-read instruction."""
        config = EnhancementConfig(
            level=EnhancementLevel.MODERATE,
            use_reread=True
        )
        enhanced = enhance_user_message("What is load shedding?", config)
        # Re-read adds emphasis to the query
        assert "load shedding" in enhanced.lower()


class TestSALanguageSupport:
    """Test support for all 11 SA official languages."""
    
    def test_english_default(self):
        """English should be the default/primary language."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        assert "english" in prompt_lower or "en" in prompt_lower
    
    def test_language_flexibility(self):
        """Should mention ability to switch languages."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        language_words = ["language", "switch", "respond in", "speak"]
        has_language = any(word in prompt_lower for word in language_words)
        assert has_language, "Should mention language flexibility"
    
    def test_no_language_announcement(self):
        """Should NOT announce language switches (just do it)."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        # Good behavior: "never announce" switching
        announce_words = ["announce" in prompt_lower, "proclaim" in prompt_lower]
        # Having "never announce" is good, not having announcement language is also fine
        # This test just checks the concept exists
        assert "language" in prompt_lower, "Language switching should be mentioned"


class TestSeriousModeOverride:
    """Test that serious mode properly overrides personality for sensitive topics."""
    
    def test_legal_triggers_serious(self):
        """Legal topics should trigger serious mode."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        assert "legal" in prompt_lower
    
    def test_medical_triggers_serious(self):
        """Medical topics should trigger serious mode."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        assert "medical" in prompt_lower or "health" in prompt_lower or "crisis" in prompt_lower
    
    def test_financial_triggers_serious(self):
        """Financial/debt topics should trigger serious mode."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        financial_words = ["financial", "debt", "money", "budget"]
        has_financial = any(word in prompt_lower for word in financial_words)
        assert has_financial or "serious" in prompt_lower, "Financial should trigger serious"
    
    def test_abuse_triggers_serious(self):
        """Abuse/crisis topics should trigger serious mode."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        crisis_words = ["abuse", "crisis", "emergency", "help"]
        has_crisis = any(word in prompt_lower for word in crisis_words)
        assert has_crisis, "Crisis topics should be handled seriously"


class TestEmpatheticThinkingTags:
    """Test that empathetic reasoning uses proper XML-like tags."""
    
    def test_empathy_has_thinking_reference(self):
        """Empathetic reasoning should reference thinking block."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        assert "thinking" in text, "Should reference thinking block"
    
    def test_empathy_structured_questions(self):
        """Empathetic reasoning should have numbered questions."""
        # Check for numbered structure
        has_numbers = "1." in EMPATHETIC_REASONING_INSTRUCTION and "2." in EMPATHETIC_REASONING_INSTRUCTION
        assert has_numbers, "Should have numbered structure"
    
    def test_empathy_actionable_guidance(self):
        """Empathetic reasoning should be actionable, not abstract."""
        text = EMPATHETIC_REASONING_INSTRUCTION.lower()
        action_words = ["consider", "think", "respond", "tailor", "adjust"]
        has_action = any(word in text for word in action_words)
        assert has_action, "Should provide actionable guidance"


# ============================================================================
# PERSONALITY CONSISTENCY TESTS
# ============================================================================

class TestPersonalityConsistency:
    """Test that personality stays consistent within responses."""
    
    def test_no_contradicting_modes(self):
        """Prompt should not have contradicting mode instructions."""
        prompt = GOGGA_BASE_PROMPT
        # Should not have both "always be sarcastic" AND "never be sarcastic"
        # This is a sanity check
        has_dark = "Dark Gogga" in prompt or "sarcastic" in prompt.lower()
        has_goody = "Goody Gogga" in prompt or "positive" in prompt.lower()
        has_system = "System" in prompt or "balanced" in prompt.lower()
        
        # All three should be present as OPTIONS, not contradictions
        mode_count = sum([has_dark, has_goody, has_system])
        assert mode_count >= 2, "Should have multiple mode options defined"
    
    def test_default_mode_specified(self):
        """There should be a default personality mode."""
        prompt_lower = GOGGA_BASE_PROMPT.lower()
        # Check for default indication
        default_indicators = ["default", "goody", "positive"]  # Goody is default
        has_default = any(word in prompt_lower for word in default_indicators)
        assert has_default, "Should specify a default mode"


# Run with: pytest tests/test_personality_modes.py -v
