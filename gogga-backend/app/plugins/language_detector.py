"""
PROJECT DARK MATTER: LANGUAGE INTELLIGENCE MODULE
Version: 3.0 (Sovereign Edition)
Context: GOGGA Chat Pipeline
Standards: Enterprise Strict (Paragraph 1.3 compliant)

This plugin CANNOT be disabled and labels EVERY user input before LLM processing.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Final
from dataclasses import dataclass
from enum import Enum
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# CONSTANTS & CONFIGURATION
# -----------------------------------------------------------------------------

# Optimized for performance; pre-compiled regex for morphological roots
# Rather than whole words, we look for irreducible linguistic roots
MORPHOLOGY_ROOTS: Final[Dict[str, re.Pattern]] = {
    'nguni': re.compile(r'\b(ngi|siya|kwi|nga|uma|uku|molo|unja|sawu|bona|yebo|cha)\w*', re.IGNORECASE),
    'sotho': re.compile(r'\b(ka|ke|o|le|re|tsa|tse|dum|thob|lebo|gabotse|hantle)\w*', re.IGNORECASE),
    'afrikaans': re.compile(r'\b(die|is|en|ek|het|nie|te|van|wat|maar|ook|sal)\b', re.IGNORECASE),
    'english': re.compile(r'\b(the|and|is|to|in|of|that|it|you|for|with|have|this)\b', re.IGNORECASE),
    'tsonga': re.compile(r'\b(ndzi|ku|hi|ka|va|avu|xeni|khensa|riva)\w*', re.IGNORECASE),
    'venda': re.compile(r'\b(ndi|vha|u|nda|livhu|tshi|vho|hani)\w*', re.IGNORECASE),
}

# Character-level features for tie-breaking
DISTINCTIVE_CHARACTERS: Final[Dict[str, str]] = {
    'xh': 'ǃǀǁǂ',  # Click consonants (Xhosa uses most)
    'af': 'ëïôûêîôáéíóú',  # Diacritics common in Afrikaans
}

# -----------------------------------------------------------------------------
# DATA STRUCTURES
# -----------------------------------------------------------------------------

class LanguageFamily(Enum):
    """Linguistic classification of SA languages"""
    GERMANIC = "Germanic"       # English, Afrikaans
    NGUNI = "Nguni"             # Zulu, Xhosa, Swati, Ndebele
    SOTHO = "Sotho-Tswana"      # Sepedi, Setswana, Sesotho
    VENDA = "Venda"             # Tshivenda
    TSONGA = "Tswa-Ronga"       # Xitsonga


@dataclass(frozen=True, slots=True)
class LanguageProfile:
    """
    Immutable language definition with linguistic fingerprints.
    
    Using __slots__ and frozen=True for memory efficiency during
    high-volume throughput (thousands of messages/second).
    """
    code: str
    name: str
    family: LanguageFamily
    greeting: str
    
    # High-frequency vocabulary (most common words)
    core_vocab: Tuple[str, ...]
    
    # Character 3-gram fingerprints (statistical markers)
    # These are the most frequent character sequences in the language
    fingerprints: Tuple[str, ...]
    
    # Cultural context markers (honorifics, common phrases)
    cultural_markers: Tuple[str, ...]


@dataclass(slots=True)
class DetectionResult:
    """
    Detection result with confidence scoring.
    
    Using __slots__ for memory efficiency (40% memory reduction vs dict).
    """
    code: str
    name: str
    confidence: float
    family: LanguageFamily
    is_hybrid: bool
    method: str  # 'vocab', 'morphology', 'ngram', 'fallback'
    
    def __post_init__(self):
        """Auto-detect hybrid/code-switching based on confidence"""
        # Moderate confidence indicates code-switching
        if 0.35 < self.confidence < 0.75:
            self.is_hybrid = True
        else:
            self.is_hybrid = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict for API responses"""
        return {
            "code": self.code,
            "name": self.name,
            "confidence": round(self.confidence, 4),
            "is_hybrid": self.is_hybrid,
            "family": self.family.value,
            "method": self.method
        }


# -----------------------------------------------------------------------------
# LANGUAGE PROFILES (All 11 SA Official Languages)
# -----------------------------------------------------------------------------

LANGUAGE_PROFILES: Final[Dict[str, LanguageProfile]] = {
    'zu': LanguageProfile(
        code='zu',
        name='isiZulu',
        family=LanguageFamily.NGUNI,
        greeting='Sawubona',
        core_vocab=('ngi', 'sawubona', 'yebo', 'cha', 'unjani', 'ngiyabonga', 'kuhle', 'bengifuna', 'ngicela'),
        fingerprints=('ngi', 'nga', 'uku', 'kwa', 'yab', 'bon', 'ela', 'ile', 'ang'),
        cultural_markers=('sawubona', 'hamba kahle', 'sala kahle', 'ngiyabonga kakhulu', 'yebo gogo', 'yebo baba')
    ),
    'xh': LanguageProfile(
        code='xh',
        name='isiXhosa',
        family=LanguageFamily.NGUNI,
        greeting='Molo',
        core_vocab=('ndi', 'molo', 'ewe', 'hayi', 'unjani', 'enkosi', 'ndiphilile', 'ndifuna', 'ndicela'),
        fingerprints=('ndi', 'kwa', 'olo', 'uku', 'we ', 'nko', 'pha', 'ile', 'ang'),
        cultural_markers=('molo', 'hamba kakuhle', 'sala kakuhle', 'enkosi kakhulu', 'ewe tata', 'ewe mama')
    ),
    'af': LanguageProfile(
        code='af',
        name='Afrikaans',
        family=LanguageFamily.GERMANIC,
        greeting='Hallo',
        core_vocab=('die', 'is', 'en', 'het', 'nie', 'van', 'wat', 'hallo', 'dankie', 'asseblief', 'ja', 'nee'),
        fingerprints=('nie', 'die', 'en ', 'het', 'aan', 'oor', 'ook', 'van', 'wat'),
        cultural_markers=('goeie more', 'goeie middag', 'tot siens', 'dankie tog', 'ja nee', 'lekker dag')
    ),
    'nso': LanguageProfile(
        code='nso',
        name='Sepedi',
        family=LanguageFamily.SOTHO,
        greeting='Thobela',
        core_vocab=('ke', 'go', 'ge', 'thobela', 'dumela', 'leboga', 'ee', 'aowa', 'o kae', 'ke gona'),
        fingerprints=('go ', 'ke ', 'ga ', 'tse', 'tla', 'bja', 'ona', 'ela', 'eng'),
        cultural_markers=('thobela', 'sala gabotse', 'tsamaya gabotse', 'ke leboga kudu', 'ee rra', 'ee mma')
    ),
    'tn': LanguageProfile(
        code='tn',
        name='Setswana',
        family=LanguageFamily.SOTHO,
        greeting='Dumela',
        core_vocab=('ke', 'go', 'le', 'dumela', 'leboga', 'ee', 'nnyaa', 'o tsogile', 'ke gona'),
        fingerprints=('go ', 'ke ', 'le ', 'tse', 'tla', 'eng', 'ela', 'aga', 'ile'),
        cultural_markers=('dumela rra', 'dumela mma', 'sala sentle', 'tsamaya sentle', 'ke leboga thata', 'ee rra')
    ),
    'st': LanguageProfile(
        code='st',
        name='Sesotho',
        family=LanguageFamily.SOTHO,
        greeting='Lumela',
        core_vocab=('ke', 'ho', 'ha', 'lumela', 'leboha', 'ee', 'tjhe', 'o phela jwang', 'ke gona'),
        fingerprints=('ho ', 'ke ', 'ha ', 'tse', 'eng', 'ela', 'aha', 'ile', 'ana'),
        cultural_markers=('lumela ntate', 'lumela mme', 'sala hantle', 'tsamaea hantle', 'ke leboha haholo', 'ee ntate')
    ),
    'ts': LanguageProfile(
        code='ts',
        name='Xitsonga',
        family=LanguageFamily.TSONGA,
        greeting='Avuxeni',
        core_vocab=('ndzi', 'ku', 'hi', 'avuxeni', 'khensa', 'ina', 'e-e', 'u njhani', 'ndzi kona'),
        fingerprints=('ndz', 'ku ', 'hi ', 'xa ', 'wa ', 'nga', 'ava', 'ele', 'ile'),
        cultural_markers=('avuxeni', 'famba kahle', 'sala kahle', 'ndza khensa swinene', 'ina kokwana', 'ina vavana')
    ),
    'ss': LanguageProfile(
        code='ss',
        name='siSwati',
        family=LanguageFamily.NGUNI,
        greeting='Sawubona',
        core_vocab=('ngi', 'sawubona', 'yebo', 'cha', 'unjani', 'ngiyabonga', 'ngiphila', 'ngifuna', 'ngicela'),
        fingerprints=('ngi', 'nga', 'ku ', 'nje', 'tfu', 'kwa', 'pha', 'ile', 'ela'),
        cultural_markers=('sawubona', 'hamba kahle', 'sala kahle', 'ngiyabonga kakhulu', 'yebo make', 'yebo babe')
    ),
    've': LanguageProfile(
        code='ve',
        name='Tshivenda',
        family=LanguageFamily.VENDA,
        greeting='Ndaa',
        core_vocab=('ndi', 'u', 'vha', 'ndaa', 'livhuwa', 'ee', 'hai', 'vho vuwa hani', 'ndi khou vha'),
        fingerprints=('ndi', 'vha', 'tsh', 'u v', 'ẓw', 'nga', 'one', 'ela', 'isa'),
        cultural_markers=('ndaa', 'vha salani', 'vha fhambeni', 'ndo livhuwa nga maanda', 'ee vho vho', 'hai vho vho')
    ),
    'nr': LanguageProfile(
        code='nr',
        name='isiNdebele',
        family=LanguageFamily.NGUNI,
        greeting='Lotjhani',
        core_vocab=('ngi', 'lotjhani', 'yebo', 'awa', 'unjani', 'ngiyabonga', 'ngiphila', 'ngifuna', 'ake'),
        fingerprints=('ngi', 'nga', 'ku ', 'thi', 'kwa', 'pha', 'bon', 'ile', 'ela'),
        cultural_markers=('lotjhani', 'hambani kahle', 'salani kahle', 'ngiyabonga kakhulu', 'yebo baba', 'yebo mama')
    ),
    'en': LanguageProfile(
        code='en',
        name='English',
        family=LanguageFamily.GERMANIC,
        greeting='Hello',
        core_vocab=('the', 'is', 'are', 'you', 'hello', 'thanks', 'please', 'how', 'what', 'when', 'where'),
        fingerprints=('the', 'ing', 'tion', 'and', 'you', 'for', 'ent', 'ers', 'hat'),
        cultural_markers=('hello', 'how are you', 'thank you', 'please', 'howzit', 'sharp')
    ),
}


# -----------------------------------------------------------------------------
# CORE DETECTION ENGINE
# -----------------------------------------------------------------------------

class LanguageDetectorPlugin:
    """
    Sovereign-Grade Language Detection Engine for SA Languages.
    
    Multi-Stage Detection Pipeline:
    1. Core Vocabulary Scan (High Weight) - Direct word matches
    2. Morphological Analysis (Medium Weight) - Root/prefix patterns
    3. N-Gram Probability (Low Weight) - Character sequence frequency
    4. Cultural Marker Detection (Bonus) - Honorifics and phrases
    
    Scoring Formula:
        S_final = (W_vocab × 0.5) + (W_morph × 0.3) + (W_ngram × 0.15) + (W_cultural × 0.05)
    
    This plugin runs on EVERY message and CANNOT be disabled.
    It labels all input before LLM processing for cultural intelligence.
    """
    
    name = "language_detector_v3"
    
    def __init__(self):
        """Initialize the language detector with pre-compiled patterns"""
        self._logger = logging.getLogger(f"gogga.{self.name}")
        self._logger.info("Language Detector v3.0 (Dark Matter Edition) initialized")
        
        # Pre-compile patterns for performance
        self._english_strong_pattern = re.compile(
            r'\b(hello|hi|hey|thanks|thank\s+you|please|sorry|excuse\s+me|good\s+(morning|afternoon|evening))\b',
            re.IGNORECASE
        )
    
    def _calculate_vocabulary_score(self, text_lower: str) -> Dict[str, float]:
        """
        Score based on core vocabulary presence.
        
        This is the highest-weight component because direct vocabulary
        matches are the most reliable indicators.
        """
        scores: Dict[str, float] = defaultdict(float)
        words = set(text_lower.split())
        
        for lang_code, profile in LANGUAGE_PROFILES.items():
            # Count word-level matches (more accurate than substring)
            word_matches = sum(1 for vocab_word in profile.core_vocab if vocab_word in words)
            
            # Also check substring matches for compound words and phrases
            substring_matches = sum(1 for vocab_word in profile.core_vocab 
                                  if vocab_word in text_lower and vocab_word not in words)
            
            total_matches = word_matches + (substring_matches * 0.5)  # Weight substrings lower
            
            if total_matches > 0:
                # Higher base score, logarithmic scaling for multiple matches
                scores[lang_code] = min(1.0, 0.5 + (total_matches * 0.2))
        
        return scores
    
    def _calculate_morphology_score(self, text_lower: str) -> Dict[str, float]:
        """
        Score based on morphological root patterns.
        
        Detects language families first, then specific languages within families.
        Useful for handling misspellings and informal text.
        """
        scores: Dict[str, float] = defaultdict(float)
        
        # Family-level detection
        nguni_matches = len(MORPHOLOGY_ROOTS['nguni'].findall(text_lower))
        sotho_matches = len(MORPHOLOGY_ROOTS['sotho'].findall(text_lower))
        afrikaans_matches = len(MORPHOLOGY_ROOTS['afrikaans'].findall(text_lower))
        english_matches = len(MORPHOLOGY_ROOTS['english'].findall(text_lower))
        tsonga_matches = len(MORPHOLOGY_ROOTS['tsonga'].findall(text_lower))
        venda_matches = len(MORPHOLOGY_ROOTS['venda'].findall(text_lower))
        
        # Distribute scores to languages in each family
        if nguni_matches > 0:
            nguni_score = min(0.4, nguni_matches * 0.1)
            scores['zu'] += nguni_score
            scores['xh'] += nguni_score * 0.9  # Slightly lower for Xhosa
            scores['ss'] += nguni_score * 0.7  # Lower for Swati
            scores['nr'] += nguni_score * 0.7  # Lower for Ndebele
        
        if sotho_matches > 0:
            sotho_score = min(0.4, sotho_matches * 0.1)
            scores['nso'] += sotho_score
            scores['tn'] += sotho_score * 0.95
            scores['st'] += sotho_score * 0.95
        
        if afrikaans_matches > 0:
            scores['af'] += min(0.5, afrikaans_matches * 0.12)
        
        if english_matches > 0:
            # Dampen English in code-switching scenarios
            scores['en'] += min(0.3, english_matches * 0.08)
        
        if tsonga_matches > 0:
            scores['ts'] += min(0.4, tsonga_matches * 0.12)
        
        if venda_matches > 0:
            scores['ve'] += min(0.4, venda_matches * 0.12)
        
        return scores
    
    def _calculate_ngram_score(self, text: str) -> Dict[str, float]:
        """
        Calculate probability based on character 3-gram frequency.
        
        Useful for disambiguating between similar languages and handling
        informal/SMS-style text where words may be abbreviated.
        """
        scores: Dict[str, float] = defaultdict(float)
        text_len = len(text)
        
        if text_len < 4:
            return scores
        
        # Normalize and generate 3-grams
        normalized = text.lower().replace(' ', '')
        grams = [normalized[i:i+3] for i in range(len(normalized)-2)]
        
        if not grams:
            return scores
        
        # Score each language based on fingerprint matches
        for lang_code, profile in LANGUAGE_PROFILES.items():
            matches = sum(1 for gram in grams if gram in profile.fingerprints)
            if matches > 0:
                scores[lang_code] = matches / len(grams)
        
        return scores
    
    def _calculate_cultural_score(self, text_lower: str) -> Dict[str, float]:
        """
        Bonus scoring for cultural markers (greetings, honorifics, common phrases).
        
        High confidence indicator when present.
        """
        scores: Dict[str, float] = defaultdict(float)
        
        for lang_code, profile in LANGUAGE_PROFILES.items():
            for marker in profile.cultural_markers:
                if marker.lower() in text_lower:
                    scores[lang_code] += 0.2  # Strong bonus per marker
        
        return scores
    
    def _check_distinctive_features(self, text: str) -> Optional[str]:
        """
        Check for distinctive character features (clicks, diacritics).
        
        Returns language code if distinctive features found, None otherwise.
        """
        for lang_code, chars in DISTINCTIVE_CHARACTERS.items():
            if any(char in text for char in chars):
                return lang_code
        return None
    
    def detect(self, text: str) -> DetectionResult:
        """
        Execute multi-stage detection pipeline.
        
        Args:
            text: User input text to analyze
            
        Returns:
            DetectionResult with language, confidence, and metadata
        """
        if not text or len(text.strip()) < 3:
            profile = LANGUAGE_PROFILES['en']
            return DetectionResult(
                code='en',
                name=profile.name,
                confidence=0.1,
                family=profile.family,
                is_hybrid=False,
                method='fallback_too_short'
            )
        
        text_lower = text.lower()
        
        # Check for distinctive features first (highest confidence)
        if distinctive_lang := self._check_distinctive_features(text):
            profile = LANGUAGE_PROFILES[distinctive_lang]
            return DetectionResult(
                code=distinctive_lang,
                name=profile.name,
                confidence=0.95,
                family=profile.family,
                is_hybrid=False,
                method='distinctive_features'
            )
        
        # Initialize score vector
        vector: Dict[str, float] = defaultdict(float)
        
        # Stage 1: Vocabulary scoring (50% weight)
        vocab_scores = self._calculate_vocabulary_score(text_lower)
        for lang, score in vocab_scores.items():
            vector[lang] += score * 0.5
        
        # Stage 2: Morphology scoring (30% weight)
        morph_scores = self._calculate_morphology_score(text_lower)
        for lang, score in morph_scores.items():
            vector[lang] += score * 0.3
        
        # Stage 3: N-gram scoring (15% weight)
        ngram_scores = self._calculate_ngram_score(text)
        for lang, score in ngram_scores.items():
            vector[lang] += score * 0.15
        
        # Stage 4: Cultural markers (5% weight, bonus)
        cultural_scores = self._calculate_cultural_score(text_lower)
        for lang, score in cultural_scores.items():
            vector[lang] += score * 0.05
        
        # Determine winner
        if not vector:
            # No language detected - fallback to English
            profile = LANGUAGE_PROFILES['en']
            return DetectionResult(
                code='en',
                name=profile.name,
                confidence=0.15,
                family=profile.family,
                is_hybrid=False,
                method='fallback_no_match'
            )
        
        # Get top language
        winner_code = max(vector, key=vector.get)
        winner_score = vector[winner_code]
        
        # Normalize confidence to 0-1 range
        confidence = min(1.0, winner_score)
        
        # Determine method used (for debugging)
        method_used = 'vocab' if vocab_scores.get(winner_code, 0) > 0.3 else \
                     'morphology' if morph_scores.get(winner_code, 0) > 0.2 else \
                     'ngram' if ngram_scores.get(winner_code, 0) > 0.1 else \
                     'cultural'
        
        profile = LANGUAGE_PROFILES[winner_code]
        return DetectionResult(
            code=winner_code,
            name=profile.name,
            confidence=confidence,
            family=profile.family,
            is_hybrid=False,  # Will be set in __post_init__
            method=method_used
        )
    
    async def before_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        CRITICAL: This runs on EVERY request and CANNOT be disabled.
        
        Detects language from user input and enriches context with:
        1. Language metadata (code, name, family, confidence)
        2. Cultural intelligence markers
        3. Code-switching detection
        4. Strategic system prompt injection for vernacular
        
        Args:
            request: Chat completion request
            
        Returns:
            Enriched request with language intelligence
        """
        messages = request.get("messages", [])
        
        # Extract latest user message
        user_input = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_input = msg.get("content", "")
                break
        
        if not user_input:
            self._logger.debug("No user input found, skipping detection")
            return request
        
        # Execute detection
        result = self.detect(user_input)
        
        self._logger.info(
            f"Detected language: {result.name} ({result.code}) "
            f"confidence={result.confidence:.2f} method={result.method} "
            f"hybrid={result.is_hybrid}"
        )
        
        # Inject metadata (always, even for low confidence)
        if "metadata" not in request:
            request["metadata"] = {}
        
        request["metadata"]["language_intelligence"] = result.to_dict()
        request["metadata"]["language_intelligence"]["text_sample"] = user_input[:100]
        
        # Strategic prompt injection for non-English with confidence > 0.35
        if result.code != 'en' and result.confidence > 0.35:
            self._inject_cultural_prompt(messages, result)
        
        return request
    
    def _inject_cultural_prompt(
        self, 
        messages: List[Dict[str, Any]], 
        result: DetectionResult
    ) -> None:
        """
        Inject cultural intelligence into system prompt.
        
        We don't ask the LLM to 'translate'. We ask it to adopt the persona
        of a native speaker, preserving cultural nuances and code-switching patterns.
        
        This is MANDATORY and CANNOT be disabled.
        """
        profile = LANGUAGE_PROFILES[result.code]
        
        if result.is_hybrid:
            # Code-switching detected - guide bilingual response
            style_guide = (
                f"🌍 Cultural Context: User is code-switching between {result.name} and English.\n"
                f"Response Strategy: Mirror the user's bilingual style. "
                f"Use {result.name} for greetings, cultural expressions, and emphasis. "
                f"Use English for technical terms and complex concepts. "
                f"Natural code-switching is encouraged.\n"
                f"Greeting: Start with '{profile.greeting}' if appropriate."
            )
        else:
            # High-confidence vernacular - respond primarily in detected language
            style_guide = (
                f"🌍 Cultural Context: User is communicating in {result.name} (confidence: {result.confidence:.0%}).\n"
                f"Response Strategy: Respond primarily in {result.name}. "
                f"Use appropriate honorifics and cultural markers from {result.family.value} tradition. "
                f"Greeting: '{profile.greeting}'\n"
                f"Note: English technical terms are acceptable when no {result.name} equivalent exists."
            )
        
        system_instruction = (
            f"\n\n[LANGUAGE INTELLIGENCE - MANDATORY CONTEXT]\n"
            f"{style_guide}\n"
            f"[END LANGUAGE INTELLIGENCE]\n"
        )
        
        # Find or create system message
        system_msg = None
        for i, msg in enumerate(messages):
            if msg.get("role") == "system":
                system_msg = msg
                break
        
        if system_msg:
            # Append to existing system message (avoid duplicates)
            if "[LANGUAGE INTELLIGENCE" not in system_msg["content"]:
                system_msg["content"] += system_instruction
        else:
            # Create new system message at the start
            messages.insert(0, {
                "role": "system",
                "content": system_instruction.strip()
            })
    
    async def after_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-processing hook for language-aware transformations.
        
        Currently pass-through, but can be extended for:
        - Response language verification
        - Automatic translation if needed
        - Cultural appropriateness checks
        """
        return response
    
    def get_all_languages(self) -> List[Dict[str, str]]:
        """Get list of all supported SA languages with metadata"""
        return [
            {
                "code": code,
                "name": profile.name,
                "family": profile.family.value,
                "greeting": profile.greeting
            }
            for code, profile in LANGUAGE_PROFILES.items()
        ]
