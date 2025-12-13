"""
Tests for Language Detection Plugin (Dark Matter v3)

Tests all 11 SA official languages, hybrid scenarios, and edge cases.

Updated for v3.0 Swadesh-enhanced vocabulary with unique word bonus scoring.
Confidence thresholds adjusted for new logarithmic scoring algorithm.
"""
import pytest
from app.plugins.language_detector import (
    LanguageDetectorPlugin,
    LanguageProfile,
    DetectionResult,
    LanguageFamily,
    LANGUAGE_PROFILES
)


@pytest.fixture
def detector():
    """Create language detector instance for testing"""
    return LanguageDetectorPlugin()


class TestLanguageProfiles:
    """Test language profile completeness"""
    
    def test_all_11_languages_present(self):
        """Verify all 11 SA official languages are defined"""
        expected_codes = {'en', 'af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 'ss', 've', 'nr'}
        assert set(LANGUAGE_PROFILES.keys()) == expected_codes
    
    def test_profile_completeness(self):
        """Verify each profile has all required fields"""
        for code, profile in LANGUAGE_PROFILES.items():
            assert isinstance(profile, LanguageProfile)
            assert profile.code == code
            assert len(profile.name) > 0
            assert isinstance(profile.family, LanguageFamily)
            assert len(profile.greeting) > 0
            assert len(profile.core_vocab) > 0
            assert len(profile.fingerprints) > 0
            assert len(profile.cultural_markers) > 0
    
    def test_vocabulary_sizes_enhanced(self):
        """Verify vocabulary sizes are enhanced (100+ words per language)"""
        for code, profile in LANGUAGE_PROFILES.items():
            assert len(profile.core_vocab) >= 100, f"{code} should have 100+ vocab words"


class TestZuluDetection:
    """Test isiZulu detection"""
    
    def test_zulu_greeting(self, detector):
        result = detector.detect("Sawubona, unjani?")
        assert result.code == 'zu'
        assert result.confidence > 0.4  # Short phrase, moderate confidence
    
    def test_zulu_thanks(self, detector):
        result = detector.detect("Ngiyabonga kakhulu!")
        assert result.code == 'zu'
        assert result.confidence > 0.45
    
    def test_zulu_sentence(self, detector):
        result = detector.detect("Ngifuna ukuya edolobheni namhlanje")
        assert result.code == 'zu'
        assert result.confidence > 0.4


class TestXhosaDetection:
    """Test isiXhosa detection"""
    
    def test_xhosa_greeting(self, detector):
        result = detector.detect("Molo, unjani namhlanje?")
        assert result.code == 'xh'
        assert result.confidence > 0.35
    
    def test_xhosa_thanks(self, detector):
        result = detector.detect("Enkosi kakhulu!")
        assert result.code == 'xh'
        assert result.confidence > 0.4
    
    def test_xhosa_click_consonants(self, detector):
        # Xhosa uses click consonants (distinctive feature)
        result = detector.detect("Ndiyaǃhala")
        assert result.code == 'xh'
        assert result.confidence > 0.9
    
    def test_xhosa_ndifuna(self, detector):
        """Test Xhosa-specific verb form 'ndifuna'"""
        result = detector.detect("Molo, ndifuna uncedo ngomthetho wami")
        assert result.code == 'xh'
        assert result.confidence > 0.5


class TestAfrikaansDetection:
    """Test Afrikaans detection"""
    
    def test_afrikaans_greeting(self, detector):
        result = detector.detect("Hallo, hoe gaan dit?")
        assert result.code == 'af'
        assert result.confidence > 0.4
    
    def test_afrikaans_negation(self, detector):
        result = detector.detect("Ek het nie tyd nie")
        assert result.code == 'af'
        assert result.confidence > 0.45
    
    def test_afrikaans_sentence(self, detector):
        result = detector.detect("Die kat is op die mat")
        assert result.code == 'af'
        assert result.confidence > 0.4


class TestSepediDetection:
    """Test Sepedi detection"""
    
    def test_sepedi_greeting(self, detector):
        result = detector.detect("Thobela, o kae?")
        assert result.code == 'nso'
        assert result.confidence > 0.4
    
    def test_sepedi_thanks(self, detector):
        result = detector.detect("Ke leboga kudu!")
        assert result.code == 'nso'
        assert result.confidence > 0.4


class TestSetswanaDetection:
    """Test Setswana detection"""
    
    def test_setswana_greeting(self, detector):
        result = detector.detect("Dumela rra, o tsogile jang?")
        assert result.code == 'tn'
        assert result.confidence > 0.4
    
    def test_setswana_thanks(self, detector):
        result = detector.detect("Ke leboga thata!")
        assert result.code == 'tn'
        assert result.confidence > 0.4


class TestSesothoDetection:
    """Test Sesotho detection"""
    
    def test_sesotho_greeting(self, detector):
        result = detector.detect("Lumela ntate, o phela jwang?")
        assert result.code == 'st'
        assert result.confidence > 0.4
    
    def test_sesotho_thanks(self, detector):
        result = detector.detect("Ke leboha haholo!")
        assert result.code == 'st'
        assert result.confidence > 0.4


class TestXitsongaDetection:
    """Test Xitsonga detection"""
    
    def test_xitsonga_greeting(self, detector):
        result = detector.detect("Avuxeni, u njhani?")
        assert result.code == 'ts'
        assert result.confidence > 0.4
    
    def test_xitsonga_thanks(self, detector):
        result = detector.detect("Ndza khensa swinene!")
        assert result.code == 'ts'
        assert result.confidence > 0.4


class TestSiswatiDetection:
    """Test siSwati detection"""
    
    def test_siswati_greeting(self, detector):
        result = detector.detect("Sawubona make, kunjani?")
        assert result.code == 'ss'
        assert result.confidence > 0.4
    
    def test_siswati_thanks(self, detector):
        result = detector.detect("Siyabonga kakhulu make!")
        assert result.code == 'ss'
        assert result.confidence > 0.4
    
    def test_siswati_make_babe(self, detector):
        """Test Swati-specific 'make/babe' honorifics vs Zulu 'umama/ubaba'"""
        result = detector.detect("Sawubona make, ngicela lusizo")
        assert result.code == 'ss'
        assert result.confidence > 0.5


class TestTshivendaDetection:
    """Test Tshivenda detection"""
    
    def test_tshivenda_greeting(self, detector):
        result = detector.detect("Ndaa, vho vuwa hani?")
        assert result.code == 've'
        assert result.confidence > 0.4
    
    def test_tshivenda_thanks(self, detector):
        result = detector.detect("Ndo livhuwa nga maanda!")
        assert result.code == 've'
        assert result.confidence > 0.4


class TestIsiNdebeleDetection:
    """Test isiNdebele detection"""
    
    def test_ndebele_greeting(self, detector):
        result = detector.detect("Lotjhani baba, unjani?")
        assert result.code == 'nr'
        assert result.confidence > 0.4
    
    def test_ndebele_thanks(self, detector):
        result = detector.detect("Ngiyathokoza kakhulu!")
        assert result.code == 'nr'
        assert result.confidence > 0.4


class TestEnglishDetection:
    """Test English detection"""
    
    def test_english_greeting(self, detector):
        result = detector.detect("Hello, how are you?")
        assert result.code == 'en'
        assert result.confidence > 0.5
    
    def test_english_sentence(self, detector):
        result = detector.detect("The quick brown fox jumps over the lazy dog")
        assert result.code == 'en'
        assert result.confidence > 0.4
    
    def test_english_sa_slang(self, detector):
        result = detector.detect("Howzit! Sharp sharp!")
        assert result.code == 'en'
        assert result.confidence > 0.35


class TestHybridCodeSwitching:
    """Test code-switching / hybrid language detection"""
    
    def test_zulu_english_mix(self, detector):
        result = detector.detect("Sawubona, I need help please")
        # Should detect Zulu but flag as hybrid
        assert result.code in ['zu', 'en']
        if result.code == 'zu':
            assert result.is_hybrid or result.confidence < 0.75
    
    def test_afrikaans_english_mix(self, detector):
        result = detector.detect("Ja nee, I agree with you")
        assert result.code in ['af', 'en']
        if result.code == 'af':
            assert result.is_hybrid or result.confidence < 0.75
    
    def test_xhosa_english_technical(self, detector):
        result = detector.detect("Molo, I need to access my database records")
        # Should detect Xhosa greeting but recognize English technical terms
        assert result.code in ['xh', 'en']


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_string(self, detector):
        result = detector.detect("")
        assert result.code == 'en'  # Fallback
        assert result.confidence < 0.2
    
    def test_very_short_text(self, detector):
        result = detector.detect("Hi")
        assert result.code == 'en'
        assert result.confidence > 0
    
    def test_numbers_only(self, detector):
        result = detector.detect("123456789")
        assert result.code == 'en'  # Fallback
        assert result.confidence < 0.3
    
    def test_punctuation_only(self, detector):
        result = detector.detect("!@#$%^&*()")
        assert result.code == 'en'  # Fallback
        assert result.confidence < 0.3
    
    def test_mixed_case(self, detector):
        result = detector.detect("SaWuBoNa UNJANI?")
        assert result.code == 'zu'
        assert result.confidence > 0.4


class TestDetectionMethods:
    """Test detection method attribution"""
    
    def test_vocabulary_method(self, detector):
        result = detector.detect("Ngiyabonga sawubona yebo")
        assert result.method == 'vocab'
    
    def test_cultural_method(self, detector):
        result = detector.detect("Hamba kahle sala kahle ngiyabonga")
        # Should detect cultural markers (Nguni languages)
        assert result.code in ['zu', 'xh', 'ss', 'nr']
        assert result.confidence > 0.4


class TestPluginIntegration:
    """Test plugin hooks"""
    
    @pytest.mark.asyncio
    async def test_before_request_enrichment(self, detector):
        request = {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant"},
                {"role": "user", "content": "Sawubona, ngicela usizo ngomthetho wami"}
            ],
            "metadata": {}
        }
        
        enriched = await detector.before_request(request)
        
        # Check metadata was added
        assert "language_intelligence" in enriched["metadata"]
        lang_data = enriched["metadata"]["language_intelligence"]
        
        assert lang_data["code"] == 'zu'
        assert lang_data["confidence"] > 0.4
        assert "text_sample" in lang_data
    
    @pytest.mark.asyncio
    async def test_system_prompt_injection(self, detector):
        request = {
            "messages": [
                {"role": "user", "content": "Ngiyabonga kakhulu!"}
            ],
            "metadata": {}
        }
        
        enriched = await detector.before_request(request)
        
        # Should have injected system message for high-confidence Zulu
        messages = enriched["messages"]
        system_msgs = [m for m in messages if m["role"] == "system"]
        
        assert len(system_msgs) > 0
        system_content = system_msgs[0]["content"]
        assert "LANGUAGE INTELLIGENCE" in system_content or "isiZulu" in system_content
    
    @pytest.mark.asyncio
    async def test_after_response_passthrough(self, detector):
        response = {
            "content": "Hello!",
            "metadata": {}
        }
        
        processed = await detector.after_response(response)
        
        # Should be pass-through currently
        assert processed == response


class TestLanguageFamilies:
    """Test language family classification"""
    
    def test_nguni_family(self, detector):
        nguni_langs = ['zu', 'xh', 'ss', 'nr']
        for code in nguni_langs:
            profile = LANGUAGE_PROFILES[code]
            assert profile.family == LanguageFamily.NGUNI
    
    def test_sotho_family(self, detector):
        sotho_langs = ['nso', 'tn', 'st']
        for code in sotho_langs:
            profile = LANGUAGE_PROFILES[code]
            assert profile.family == LanguageFamily.SOTHO
    
    def test_germanic_family(self, detector):
        germanic_langs = ['en', 'af']
        for code in germanic_langs:
            profile = LANGUAGE_PROFILES[code]
            assert profile.family == LanguageFamily.GERMANIC


class TestConfidenceScoring:
    """Test confidence scoring ranges"""
    
    def test_high_confidence_cultural_markers(self, detector):
        """Longer phrases with multiple markers should have higher confidence"""
        result = detector.detect("Sawubona sanibonani yebo gogo ngiyabonga kakhulu")
        assert result.confidence > 0.45
    
    def test_medium_confidence_mixed(self, detector):
        result = detector.detect("Hello ngiyabonga thanks")
        # Mixed languages should have moderate confidence
        assert 0.3 < result.confidence < 0.8
    
    def test_low_confidence_ambiguous(self, detector):
        result = detector.detect("ok yes sure")
        # Very ambiguous should have low confidence
        assert result.confidence < 0.6


class TestAll11Languages:
    """Test complete detection for all 11 SA official languages"""
    
    def test_all_languages_with_legal_phrases(self, detector):
        """
        Test realistic legal consultation phrases in all 11 languages.
        These are the canonical test phrases for the detector.
        """
        test_phrases = {
            'zu': 'Sawubona, ngicela usizo ngomthetho wami',
            'xh': 'Molo, ndifuna uncedo ngomthetho wami',
            'af': 'Hallo, ek het hulp nodig met my saak',
            'nso': 'Thobela, ke nyaka thušo ka molao',
            'tn': 'Dumela, ke batla thuso ka molao',
            'st': 'Lumela, ke batla thuso ka molao waka',
            'ts': 'Avuxeni, ndzi lava mpfuno hi nawu',
            've': 'Ndaa, ndi toda thuso nga mulayo',
            'ss': 'Sawubona make, ngicela lusizo',
            'nr': 'Lotjhani, ngibawa usizo ngomthetho',
            'en': 'Hello, I need help with my legal matter'
        }
        
        correct = 0
        for expected, text in test_phrases.items():
            result = detector.detect(text)
            if result.code == expected:
                correct += 1
            assert result.code == expected, f"Expected {expected} for '{text}', got {result.code}"
        
        assert correct == 11, f"Only {correct}/11 languages correctly detected"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
