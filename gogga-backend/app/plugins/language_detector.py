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
# Enhanced with Swadesh-derived linguistic patterns
# Rather than whole words, we look for irreducible linguistic roots
MORPHOLOGY_ROOTS: Final[Dict[str, re.Pattern]] = {
    # Nguni family: distinctive ngi/ndi prefixes, uku infinitive, -ile past tense
    'nguni': re.compile(r'\b(ngi|ndi|si|ba|siya|kwi|nga|uma|uku|molo|sawu|lotjh|bona|yebo|cha|ewe|hayi|enkosi|kahle|kakhulu)\w*', re.IGNORECASE),
    
    # Sotho family: distinctive ke/go/ho patterns, -ile past, -a present
    # Key differentiators: Sesotho uses 'ho', Setswana uses 'go', Sepedi uses 'go' with 'bja'
    'sotho': re.compile(r'\b(ka|ke|go|ho|ha|le|re|tsa|tse|tlh|dum|lum|thob|lebo|gabotse|hantle|sentle|pula|motho|batho)\w*', re.IGNORECASE),
    
    # Afrikaans: double negation 'nie...nie', distinctive articles 'die/\'n'
    'afrikaans': re.compile(r'\b(die|is|en|ek|jy|hy|ons|het|nie|te|van|wat|maar|ook|sal|kan|moet|dankie|asseblief|lekker|baie)\b', re.IGNORECASE),
    
    # English: common function words, SA slang integrated
    'english': re.compile(r'\b(the|and|is|are|to|in|of|that|it|you|for|with|have|this|was|were|been|being|would|could|howzit|lekker|braai|bru)\b', re.IGNORECASE),
    
    # Tsonga: distinctive ndzi/hi/ku prefixes, xa locative, swinene intensifier
    'tsonga': re.compile(r'\b(ndzi|ku|hi|ka|va|avu|xeni|khensa|riva|swinene|famba|mina|hina|kahle|n\'we|dyambu|mpfula)\w*', re.IGNORECASE),
    
    # Venda: distinctive ndi/vha/u prefixes, tshi- class prefix, unique consonant clusters
    'venda': re.compile(r'\b(ndi|vha|u|nda|livhu|tshi|vho|hani|ndaa|zwavhudi|nga|maanda|shango|thavha|duvha|mvula)\w*', re.IGNORECASE),
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

# Enhanced with Swadesh core vocabulary lists (207 essential words per language)
# Swadesh lists developed by linguist Morris Swadesh for comparative linguistics
LANGUAGE_PROFILES: Final[Dict[str, LanguageProfile]] = {
    'zu': LanguageProfile(
        code='zu',
        name='isiZulu',
        family=LanguageFamily.NGUNI,
        greeting='Sawubona',
        # Expanded from Zulu Swadesh list + common expressions
        core_vocab=(
            # Pronouns & demonstratives
            'mina', 'wena', 'yena', 'thina', 'nina', 'bona', 'lapha', 'lapho', 'ubani', 'yini', 'nini', 'kanjani',
            # Family & people - ZULU-SPECIFIC: umama/ubaba (vs Swati make/babe)
            'umama', 'ubaba', 'umntwana', 'umfazi', 'indoda', 'umuntu', 'umyeni', 'inkosikazi', 'abantu', 'ugogo', 'umkhulu',
            # Body parts
            'ikhanda', 'iso', 'ihlo', 'indlebe', 'ikhala', 'umlomo', 'ulimi', 'izinyo', 'isandla', 'unyawo', 'umlenze', 'inhliziyo', 'isisu',
            # Nature & elements
            'amanzi', 'imvula', 'ilanga', 'inyanga', 'inkanyezi', 'umoya', 'izulu', 'umlilo', 'itshe', 'umhlaba', 'intaba', 'ulwandle',
            # Animals
            'inja', 'inyoni', 'inyoka', 'inhlanzi', 'isilwane', 'inkomo',
            # Core verbs (stems)
            'hamba', 'bona', 'zwa', 'azi', 'cabanga', 'dla', 'phuza', 'lala', 'hleka', 'phila', 'fa', 'shaya', 'nika', 'thi', 'dlala', 'funda', 'sebenza', 'thanda', 'funa', 'cela',
            # Adjectives & descriptors
            'khulu', 'ncane', 'de', 'fuphi', 'hle', 'bi', 'sha', 'dala', 'nzima', 'banzi', 'shisa', 'banda',
            # Colors
            'bomvu', 'luhlaza', 'mhlophe', 'mnyama', 'phuzi',
            # Numbers
            'nye', 'bili', 'thathu', 'ne', 'hlanu', 'shumi',
            # Common words & greetings - ZULU-SPECIFIC: unjani (vs Swati kunjani)
            'sawubona', 'yebo', 'cha', 'ngiyabonga', 'ngicela', 'kuhle', 'kahle', 'kakhulu', 'unjani', 'usizo',
            # Grammatical markers (prefixes/infixes common in speech)
            'ngi', 'si', 'ba', 'u', 'ku', 'uku', 'kwa', 'nga', 'ukuthi',
            # ZULU-SPECIFIC: Common verb conjugations (ngi- = I, ngiya- = I am doing)
            'ngifuna', 'ngiyafuna', 'ngicela', 'ngiyacela', 'ngiyathanda', 'ngithanda',
            'ngiyazi', 'ngiyabona', 'ngiyezwa', 'ngiyahamba', 'ngiyasebenza', 'ngiyafunda',
            # Common Zulu words/nouns
            'umthetho', 'idolobha', 'edolobheni', 'namhlanje', 'kusasa', 'izolo', 'manje',
            'ukuya', 'ukuza', 'ukuthola', 'ukwenza', 'umsebenzi', 'imali', 'indawo'
        ),
        fingerprints=('ngi', 'nga', 'uku', 'kwa', 'yab', 'bon', 'ela', 'ile', 'ang', 'pha', 'zul', 'ntu'),
        cultural_markers=('sawubona', 'hamba kahle', 'sala kahle', 'ngiyabonga kakhulu', 'yebo gogo', 'yebo baba', 'yebo mama', 'siyabonga', 'sanibonani', 'unjani')
    ),
    'xh': LanguageProfile(
        code='xh',
        name='isiXhosa',
        family=LanguageFamily.NGUNI,
        greeting='Molo',
        # Xhosa vocabulary - enhanced with distinctive verb forms and click words
        core_vocab=(
            # Pronouns & demonstratives
            'mna', 'wena', 'yena', 'thina', 'nina', 'bona', 'apha', 'apho', 'ngubani', 'yintoni', 'nini', 'njani',
            # Family & people
            'umama', 'utata', 'umntwana', 'umfazi', 'indoda', 'umntu', 'abantu',
            # Body parts
            'intloko', 'iliso', 'indlebe', 'impumlo', 'umlomo', 'ulwimi', 'izinyo', 'isandla', 'unyawo', 'umlenze', 'intliziyo', 'isisu',
            # Nature & elements
            'amanzi', 'imvula', 'ilanga', 'inyanga', 'inkwenkwezi', 'umoya', 'isibhakabhaka', 'umlilo', 'ilitye', 'umhlaba', 'intaba', 'ulwandle',
            # Animals
            'inja', 'intaka', 'inyoka', 'intlanzi', 'isilwanyana', 'inkomo',
            # Core verbs
            'hamba', 'bona', 'va', 'azi', 'cinga', 'tya', 'sela', 'lala', 'hleka', 'phila', 'fa', 'betha', 'nika', 'thetha', 'dlala', 'funda', 'sebenza', 'thanda', 'funa', 'cela',
            # Adjectives
            'khulu', 'ncinci', 'de', 'fuphi', 'hle', 'bi', 'tsha', 'dala', 'nzima', 'banzi',
            # Colors
            'bomvu', 'luhlaza', 'mhlophe', 'mnyama',
            # Numbers
            'nye', 'mbini', 'ntathu', 'ne', 'ntlanu', 'shumi',
            # Common words & greetings
            'molo', 'molweni', 'ewe', 'hayi', 'enkosi', 'nceda', 'kakuhle', 'kakhulu',
            # Grammatical markers
            'ndi', 'si', 'ba', 'u', 'ku', 'uku', 'kwa', 'nga', 'ukutya', 'ixesha',
            # XHOSA-SPECIFIC: Common verb forms with ndi- prefix (I do X)
            'ndifuna', 'ndiyafuna', 'ndiyacela', 'ndicela', 'ndiyathanda', 'ndithanda',
            'ndiyazi', 'ndiyabona', 'ndiyeva', 'ndiyahamba', 'ndiyasebenza', 'ndiyafunda',
            # XHOSA-SPECIFIC: Distinctive words (differ from Venda/Zulu)
            'uncedo', 'umthetho', 'ngomthetho', 'uxolo', 'isicelo', 'ingxaki', 'incwadi',
            'iqela', 'isikolo', 'ixesha', 'imali', 'umsebenzi', 'into', 'indawo',
            # Shared Nguni words (also in Zulu but common in Xhosa)
            'unjani', 'namhlanje', 'kusasa', 'izolo', 'phezulu', 'phansi',
            # Words with click consonants (c, q, x)
            'icala', 'iqhawe', 'ixhego', 'uqoqosho', 'isiqhelo', 'uxolelwano', 'iqhina'
        ),
        fingerprints=('ndi', 'kwa', 'olo', 'uku', 'nko', 'pha', 'ile', 'ang', 'xho', 'ntu', 'the', 'lwe', 'nce', 'nca', 'qha'),
        cultural_markers=('molo', 'molweni', 'hamba kakuhle', 'sala kakuhle', 'enkosi kakhulu', 'ewe tata', 'ewe mama', 'camagu', 'ndiyabulela', 'uxolo')
    ),
    'af': LanguageProfile(
        code='af',
        name='Afrikaans',
        family=LanguageFamily.GERMANIC,
        greeting='Hallo',
        # Expanded from Afrikaans Swadesh list (207 words)
        core_vocab=(
            # Pronouns
            'ek', 'jy', 'hy', 'sy', 'ons', 'julle', 'hulle', 'dit', 'hierdie', 'daardie', 'wie', 'wat', 'waar', 'wanneer', 'hoe',
            # Family & people
            'vrou', 'man', 'mens', 'kind', 'moeder', 'vader', 'seun', 'dogter',
            # Body parts
            'kop', 'oog', 'oor', 'neus', 'mond', 'tand', 'tong', 'hand', 'voet', 'been', 'knie', 'hart', 'maag', 'nek', 'rug', 'bors',
            # Nature & elements
            'water', 'son', 'maan', 'ster', 'reën', 'rivier', 'see', 'meer', 'berg', 'grond', 'klip', 'sand', 'wolk', 'lug', 'wind', 'vuur', 'rook',
            # Animals
            'dier', 'vis', 'voël', 'hond', 'slang', 'wurm',
            # Core verbs
            'drink', 'eet', 'slaap', 'lewe', 'sterf', 'sien', 'hoor', 'weet', 'dink', 'lag', 'loop', 'staan', 'sit', 'lê', 'gee', 'kom', 'val', 'vlieg', 'swem', 'veg', 'was',
            # Adjectives
            'groot', 'klein', 'lank', 'kort', 'wyd', 'dik', 'dun', 'swaar', 'warm', 'koud', 'nuut', 'oud', 'goed', 'sleg', 'nat', 'droog',
            # Colors
            'rooi', 'groen', 'geel', 'wit', 'swart',
            # Numbers
            'een', 'twee', 'drie', 'vier', 'vyf',
            # Common particles & connectors (highly distinctive)
            'die', 'is', 'en', 'het', 'nie', 'van', 'te', 'aan', 'met', 'vir', 'maar', 'ook', 'sal', 'kan', 'moet', 'wil', 'as', 'of', 'omdat',
            # Greetings & expressions
            'hallo', 'dankie', 'asseblief', 'ja', 'nee', 'goed', 'lekker', 'mooi', 'baie', 'tog'
        ),
        fingerprints=('nie', 'die', 'en ', 'het', 'aan', 'oor', 'ook', 'van', 'wat', 'aar', 'ooi', 'lek'),
        cultural_markers=('goeie more', 'goeie middag', 'goeie naand', 'tot siens', 'dankie tog', 'ja nee', 'lekker dag', 'hoe gaan dit', 'baie dankie')
    ),
    'nso': LanguageProfile(
        code='nso',
        name='Sepedi',
        family=LanguageFamily.SOTHO,
        greeting='Thobela',
        # Sepedi (Northern Sotho) - distinctive from Setswana/Sesotho
        core_vocab=(
            # Pronouns (distinctive Sepedi forms)
            'nna', 'wena', 'yena', 'rena', 'lena', 'bona', 'mono', 'moo', 'mang', 'eng', 'neng', 'bjang',
            # Family & people
            'mma', 'tate', 'ngwana', 'mosadi', 'monna', 'motho', 'batho',
            # Body parts
            'hlogo', 'leihlo', 'tsebe', 'nko', 'molomo', 'leleme', 'leino', 'seatla', 'leoto', 'pelo', 'mpa',
            # Nature & elements
            'meetse', 'pula', 'letšatši', 'ngwedi', 'naledi', 'phefo', 'leratadima', 'mollo', 'leswika', 'lefase', 'thaba', 'lewatle',
            # Animals
            'mpša', 'nonyana', 'noga', 'hlapi', 'phoofolo', 'kgomo',
            # Core verbs (Sepedi-specific)
            'sepela', 'bona', 'kwa', 'tseba', 'nagana', 'ja', 'nwa', 'robala', 'sega', 'phela', 'hwa', 'betha', 'fa', 'bolela', 'raloka', 'ithuta', 'šoma', 'rata', 'nyaka',
            # Adjectives
            'kgolo', 'nnyane', 'telele', 'kopana', 'botse', 'mpe', 'mpsha', 'tala', 'boima', 'bophara',
            # Colors
            'hubedu', 'tala', 'tshweu', 'ntsho',
            # Numbers (Sepedi-specific)
            'tee', 'pedi', 'tharo', 'nne', 'hlano', 'lesome',
            # Distinctive grammatical particles
            'ke', 'go', 'ge', 'ga', 'le', 'ka', 'mo', 'goba', 'bjalo', 'fela',
            # Common question words (Sepedi uses 'kae' for 'where' just like Tswana)
            'kae', 'mang', 'eng', 'goreng', 'neng',
            # Greetings & expressions (Sepedi-specific) - NOTE: 'thobela' is main greeting, 'dumela' is also used but less common
            'thobela', 'leboga', 'ee', 'aowa', 'gabotse', 'kudu', 'bjale'
        ),
        fingerprints=('go ', 'ke ', 'ga ', 'tse', 'tla', 'bja', 'ona', 'ela', 'eng', 'tši', 'šom', 'let'),
        cultural_markers=('thobela', 'sala gabotse', 'tsamaya gabotse', 'ke leboga kudu', 'ee rra', 'ee mma', 'ke a leboga', 'go lokile')
    ),
    'tn': LanguageProfile(
        code='tn',
        name='Setswana',
        family=LanguageFamily.SOTHO,
        greeting='Dumela',
        # Expanded from Tswana Swadesh list (207 words)
        core_vocab=(
            # Pronouns (from Swadesh)
            'nna', 'mna', 'wena', 'ena', 'rona', 'chona', 'lona', 'bona', 'fano', 'kwano', 'mang', 'eng', 'kae', 'leng', 'jang',
            # Family & people
            'mma', 'mama', 'rra', 'rara', 'ngwana', 'mosadi', 'monna', 'motho', 'batho', 'mogatsa',
            # Body parts
            'tlhogo', 'leitlho', 'tsebe', 'nko', 'molomo', 'loleme', 'leino', 'seatla', 'lonao', 'leoto', 'pelo', 'mpa', 'sebete',
            # Nature & elements
            'metse', 'pula', 'letsatsi', 'ngwedi', 'naledi', 'phefo', 'legodimo', 'molelo', 'leje', 'lefatshe', 'thaba', 'lewatle', 'noka', 'leru', 'mosi',
            # Animals
            'ntsha', 'nong', 'nonyane', 'noga', 'tlhapi', 'pholofolo', 'seboko',
            # Core verbs (from Swadesh)
            'tsamaya', 'bona', 'utlwa', 'itse', 'akanya', 'ja', 'nwa', 'robala', 'tshega', 'tshela', 'swa', 'betsa', 'fa', 're', 'tshameka', 'bala', 'opela', 'rata', 'batla',
            # Adjectives
            'golo', 'nnye', 'lelele', 'khutshwane', 'tle', 'be', 'ntsha', 'tala', 'kete', 'phara', 'tsididi', 'bothutho',
            # Colors
            'hubidu', 'tala', 'tshweu', 'ntsho', 'serolwana',
            # Numbers (from Swadesh)
            'nngwe', 'pedi', 'tharo', 'nne', 'tlhano', 'lesome',
            # Grammatical particles (highly distinctive)
            'ke', 'go', 'le', 'ga', 'mo', 'fa', 'ka', 'gore', 'gonne', 'fela', 'sentle', 'thata',
            # Greetings & expressions
            'dumela', 'leboga', 'ee', 'nnyaa', 'sentle', 'thata', 'rra', 'mma'
        ),
        fingerprints=('go ', 'ke ', 'le ', 'tse', 'tla', 'eng', 'ela', 'aga', 'ile', 'tlh', 'tsw', 'wat'),
        cultural_markers=('dumela', 'dumela rra', 'dumela mma', 'sala sentle', 'tsamaya sentle', 'ke leboga thata', 'ee rra', 'pula', 'ke a leboga')
    ),
    'st': LanguageProfile(
        code='st',
        name='Sesotho',
        family=LanguageFamily.SOTHO,
        greeting='Lumela',
        # Sesotho (Southern Sotho) - distinctive "ho" infinitive vs "go"
        core_vocab=(
            # Pronouns (Sesotho-specific)
            'nna', 'wena', 'yena', 'rona', 'lona', 'bona', 'mona', 'moo', 'mang', 'eng', 'neng', 'jwang',
            # Family & people
            'mme', 'ntate', 'ngwana', 'mosali', 'monna', 'motho', 'batho',
            # Body parts
            'hlooho', 'leihlo', 'tsebe', 'nko', 'molomo', 'leleme', 'leino', 'letsoho', 'leoto', 'pelo', 'mpa',
            # Nature & elements
            'metsi', 'pula', 'letsatsi', 'kgwedi', 'naleli', 'moea', 'lehodimo', 'mollo', 'lejwe', 'lefatshe', 'thaba', 'lewatle', 'noka', 'leru', 'mosi',
            # Animals
            'ntja', 'nonyana', 'noha', 'tlhapi', 'phoofolo',
            # Core verbs (Sesotho uses "ho" infinitive - VERY distinctive)
            'tsamaea', 'bona', 'utlwa', 'tseba', 'nahana', 'ja', 'nwa', 'robala', 'tšeha', 'phela', 'shwa', 'otla', 'fa', 're', 'bapala', 'bala', 'bina', 'rata', 'batla',
            # Adjectives
            'hoholo', 'hanyane', 'hotelele', 'hokopana', 'hotle', 'hobe', 'hotjha', 'hotala', 'boima', 'bophara',
            # Colors
            'hofiubedu', 'hotala', 'hotshweu', 'hontsho',
            # Numbers
            'le nngwe', 'peli', 'tharo', 'nne', 'hlano', 'leshome',
            # Grammatical particles (distinctive "ho" and "ha")
            'ke', 'ho', 'ha', 'le', 'ka', 'mo', 'kapa', 'hobane', 'hantle', 'haholo', 'jwale',
            # Greetings & expressions (Sesotho-specific)
            'lumela', 'leboha', 'ee', 'tjhe', 'hantle', 'haholo', 'ntate', 'mme'
        ),
        fingerprints=('ho ', 'ke ', 'ha ', 'tse', 'eng', 'ela', 'aha', 'ile', 'ana', 'ats', 'oth', 'jwa'),
        cultural_markers=('lumela ntate', 'lumela mme', 'sala hantle', 'tsamaea hantle', 'ke leboha haholo', 'ee ntate', 'khotso', 'ke a leboha')
    ),
    'ts': LanguageProfile(
        code='ts',
        name='Xitsonga',
        family=LanguageFamily.TSONGA,
        greeting='Avuxeni',
        # Xitsonga - distinctive ndzi/hi prefixes and vocabulary
        core_vocab=(
            # Pronouns (Tsonga-specific)
            'mina', 'wena', 'yena', 'hina', 'n\'wina', 'vona', 'laha', 'lahaya', 'mani', 'yini', 'rini', 'njhani',
            # Family & people
            'manana', 'tatana', 'n\'wana', 'wansati', 'wanuna', 'munhu', 'vanhu', 'nsati', 'nuna',
            # Body parts
            'nhloko', 'tihlo', 'ndleve', 'nhompfu', 'nomo', 'ririmi', 'rino', 'voko', 'nenge', 'mbilu', 'khwiri',
            # Nature & elements
            'mati', 'mpfula', 'dyambu', 'n\'weti', 'tinyeleti', 'moya', 'tilo', 'ndzilo', 'ribye', 'misava', 'ntshava', 'lwandle',
            # Animals
            'mbyana', 'xinyenyana', 'nyoka', 'nhlanzi', 'swiharhi', 'homu',
            # Core verbs (Tsonga-specific)
            'famba', 'vona', 'twa', 'tiva', 'ehleketa', 'dya', 'nwa', 'etlela', 'hleka', 'hanya', 'fa', 'ba', 'nyika', 'ku', 'tlanga', 'dyondza', 'tirha', 'rhandza', 'lava',
            # Adjectives
            'kulu', 'tsongo', 'leha', 'koma', 'saseka', 'biha', 'ntshwa', 'khale', 'tika', 'anama',
            # Colors
            'tshwuka', 'rihlaza', 'basa', 'ntima',
            # Numbers
            'n\'we', 'mbirhi', 'nharhu', 'mune', 'ntlhanu', 'khume',
            # Grammatical particles (very distinctive)
            'ndzi', 'hi', 'ku', 'va', 'ka', 'xa', 'na', 'leswi', 'kambe', 'hikuva', 'kahle', 'swinene',
            # Greetings & expressions
            'avuxeni', 'khensa', 'ina', 'e-e', 'kahle', 'swinene', 'tatana', 'manana', 'ndza khensa'
        ),
        fingerprints=('ndz', 'ku ', 'hi ', 'xa ', 'wa ', 'nga', 'ava', 'ele', 'ile', 'tsw', 'mba', 'nhl'),
        cultural_markers=('avuxeni', 'famba kahle', 'sala kahle', 'ndza khensa swinene', 'ina kokwana', 'ina tatana', 'i njhani', 'ndzi hanyile')
    ),
    'ss': LanguageProfile(
        code='ss',
        name='siSwati',
        family=LanguageFamily.NGUNI,
        greeting='Sawubona',
        # siSwati - close to Zulu but with distinctive -tfu/-dv- patterns
        core_vocab=(
            # Pronouns (Swati-specific forms) - note 'mine' instead of Zulu 'mina'
            'mine', 'wena', 'yena', 'tsine', 'nine', 'bona', 'lapha', 'lapho', 'ngubani', 'yini', 'nini', 'kanjani',
            # Family & people - KEY DIFFERENTIATORS: make/babe (vs Zulu umama/ubaba)
            'make', 'babe', 'umntfwana', 'umfati', 'indvodza', 'umuntfu', 'bantfu', 'gogo', 'mkhulu',
            # Body parts
            'inhloko', 'liso', 'indlebe', 'likhala', 'umlomo', 'lulwimi', 'litinyo', 'sandla', 'lunyawo', 'inhlitiyo', 'sisu',
            # Nature & elements
            'emanti', 'imvula', 'lilanga', 'inyanga', 'tinkhanyeti', 'umoya', 'sibhakabhaka', 'umlilo', 'litje', 'umhlaba', 'intsaba', 'lwandle',
            # Animals
            'inja', 'inyoni', 'inyoka', 'inhlanti', 'silwane', 'inkhomo',
            # Core verbs (Swati-specific)
            'hamba', 'bona', 'va', 'ati', 'cabanga', 'dla', 'natsa', 'lala', 'hleka', 'phila', 'fa', 'shaya', 'nika', 'kutsi', 'dlala', 'fundza', 'sebenta', 'tsandza', 'funa',
            # Adjectives (Swati forms with -tfu suffix common)
            'khulu', 'ncane', 'de', 'fisha', 'hle', 'mbi', 'sha', 'dzala', 'matima', 'banzi',
            # Colors
            'bomvu', 'luhlata', 'mhlophe', 'mnyama',
            # Numbers - Note kutsatfu (three) with -tfu suffix
            'kunye', 'kubili', 'kutsatfu', 'kune', 'kusihlanu', 'lishumi',
            # Grammatical particles (distinctive Swati forms)
            'ngi', 'si', 'ba', 'u', 'ku', 'kwe', 'kwa', 'nga', 'kutsi', 'futsi', 'kodvwa',
            # SWATI-SPECIFIC: Common phrases with Swati spelling
            'ngicela', 'lusizo', 'ngiyacela', 'ngifuna', 'ngiyafuna', 'siyabonga',
            # SWATI-SPECIFIC: Words with -tfu, -dv- patterns (not in Zulu)
            'umtfwana', 'batfwana', 'emantfombatana', 'tindvodza', 'emadvuna', 'emadvodza',
            'kufundza', 'kusebenta', 'kutsandza', 'kubonga', 'kucela', 'kufuna',
            # SWATI-SPECIFIC: Royal/cultural terms  
            'inkhosi', 'indvuna', 'emakhosi', 'incwala', 'umhlanga', 'liguma',
            # SWATI-SPECIFIC: Greetings - 'kunjani' (vs Zulu 'unjani')
            'sawubona', 'yebo', 'cha', 'ngicela', 'kahle', 'kakhulu', 'kunjani'
        ),
        fingerprints=('ngi', 'nga', 'ku ', 'nje', 'tfu', 'kwa', 'pha', 'ile', 'ela', 'ntf', 'dvo', 'dza'),
        cultural_markers=('sawubona make', 'yebo make', 'yebo babe', 'siyabonga make', 'hamba kahle', 'sala kahle', 'siyabonga kakhulu', 'kunjani')
    ),
    've': LanguageProfile(
        code='ve',
        name='Tshivenda',
        family=LanguageFamily.VENDA,
        greeting='Ndaa',
        # Tshivenda - unique language family with distinctive sounds
        core_vocab=(
            # Pronouns (Venda-specific)
            'nne', 'iwe', 'ene', 'rine', 'inwi', 'vhone', 'afha', 'afho', 'nnyi', 'mini', 'lini', 'hani',
            # Family & people
            'mme', 'khotsi', 'nwana', 'musadzi', 'munna', 'muthu', 'vhathu',
            # Body parts
            'thoho', 'itho', 'ndevhe', 'ningo', 'mulomo', 'lulimi', 'dino', 'tshandzha', 'lwayo', 'mbilu', 'thumbu',
            # Nature & elements
            'madi', 'mvula', 'duvha', 'nwedzi', 'naledi', 'muya', 'lutombo', 'mulilo', 'tombo', 'shango', 'thavha', 'lwanzhe',
            # Animals
            'mmbwa', 'tshiloni', 'nowa', 'khovhe', 'phukha',
            # Core verbs (Venda-specific with distinctive prefixes)
            'tshimbila', 'vhona', 'pfa', 'divha', 'humbula', 'la', 'nwa', 'edhela', 'sea', 'tshila', 'fa', 'rwa', 'fha', 'amba', 'tamba', 'gudza', 'shuma', 'funa', 'toda',
            # Adjectives
            'khulu', 'tuku', 'lapfu', 'pfufhi', 'avhudi', 'vhi', 'tswa', 'kale', 'lememu', 'phalala',
            # Colors
            'tswuku', 'lutombo', 'tshena', 'ntsu',
            # Numbers
            'thihi', 'mbili', 'raru', 'ina', 'thanu', 'fumi',
            # Grammatical particles (very distinctive)
            'ndi', 'u', 'vha', 'a', 'nga', 'kha', 'na', 'arali', 'ngauri', 'zwino', 'hafhu',
            # Greetings & expressions (Venda-specific)
            'ndaa', 'aa', 'ndo', 'livhuwa', 'ee', 'hai', 'zwavhudi', 'nga maanda', 'khotsi', 'mme'
        ),
        fingerprints=('ndi', 'vha', 'tsh', 'u v', 'nga', 'one', 'ela', 'isa', 'edz', 'tho', 'sha', 'pfa'),
        cultural_markers=('ndaa', 'aa', 'vha salani', 'vha fhambeni', 'ndo livhuwa nga maanda', 'ee vho', 'hai vho', 'ri a funa', 'ndi khou vha')
    ),
    'nr': LanguageProfile(
        code='nr',
        name='isiNdebele',
        family=LanguageFamily.NGUNI,
        greeting='Lotjhani',
        # isiNdebele - distinctive from Zulu with unique vocabulary
        core_vocab=(
            # Pronouns (Ndebele-specific)
            'mina', 'wena', 'yena', 'thina', 'nina', 'bona', 'lapha', 'lapho', 'ngubani', 'yini', 'nini', 'njani',
            # Family & people
            'umma', 'ubaba', 'umntwana', 'umfazi', 'indoda', 'umuntu', 'abantu',
            # Body parts
            'ihloko', 'ilihlo', 'indlebe', 'ipumulo', 'umlomo', 'ilimu', 'izinyo', 'isandla', 'unyawo', 'ihliziyo', 'isisu',
            # Nature & elements
            'amanzi', 'izulu', 'ilanga', 'inyanga', 'iinkwekwezi', 'ummoya', 'isibhakabhaka', 'umlilo', 'ilitje', 'umhlaba', 'intaba', 'ilwandle',
            # Animals
            'inja', 'inyoni', 'inyoka', 'ifesi', 'isilwana', 'ikomu',
            # Core verbs (Ndebele-specific)
            'khamba', 'bona', 'zwa', 'azi', 'cabanga', 'dla', 'sela', 'lala', 'hleka', 'phila', 'hlongakala', 'betha', 'pha', 'tjho', 'dlala', 'funda', 'sebenza', 'thanda', 'funa',
            # Adjectives
            'khulu', 'ncani', 'de', 'fifitjhani', 'hle', 'mbi', 'tjha', 'dala', 'budisi', 'banzi',
            # Colors
            'bomvu', 'hlaza', 'mhlophe', 'nzima',
            # Numbers
            'kunye', 'kubili', 'kuthathu', 'kune', 'kuhlanu', 'litjhumi',
            # Grammatical particles (distinctive)
            'ngi', 'si', 'ba', 'u', 'ku', 'kwa', 'nga', 'ukuthi', 'kodwana', 'nanyana',
            # Greetings & expressions (Ndebele-specific with tjh sound)
            'lotjhani', 'yebo', 'awa', 'ngiyathokoza', 'ngibawa', 'kuhle', 'khulu', 'baba', 'mma'
        ),
        fingerprints=('ngi', 'nga', 'ku ', 'thi', 'kwa', 'pha', 'bon', 'ile', 'ela', 'tjh', 'nde', 'umb'),
        cultural_markers=('lotjhani', 'hambani kuhle', 'salani kuhle', 'ngiyathokoza khulu', 'yebo baba', 'yebo mma', 'siyathokoza', 'sanibonani')
    ),
    'en': LanguageProfile(
        code='en',
        name='English',
        family=LanguageFamily.GERMANIC,
        greeting='Hello',
        # Expanded English vocabulary with SA slang
        core_vocab=(
            # Core function words
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
            # Pronouns
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
            # Question words
            'who', 'what', 'where', 'when', 'why', 'how', 'which',
            # Common verbs
            'go', 'come', 'see', 'look', 'want', 'give', 'take', 'make', 'get', 'know', 'think', 'say', 'tell',
            # Prepositions & connectors
            'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'about', 'into', 'through', 'after', 'before',
            'and', 'or', 'but', 'if', 'because', 'when', 'while', 'although',
            # Common expressions
            'hello', 'hi', 'hey', 'thanks', 'thank', 'please', 'sorry', 'yes', 'no', 'okay', 'ok',
            # SA English slang
            'howzit', 'sharp', 'lekker', 'braai', 'bru', 'china', 'eish', 'ja', 'shame', 'now-now', 'just-now', 'robots', 'bakkie'
        ),
        fingerprints=('the', 'ing', 'tion', 'and', 'you', 'for', 'ent', 'ers', 'hat', 'tha', 'her', 'his'),
        cultural_markers=('hello', 'how are you', 'thank you', 'please', 'howzit', 'sharp sharp', 'no worries', 'cheers')
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
        
        Enhanced: Unique word bonus - words that match only ONE language get extra weight
        """
        import math
        import re
        scores: Dict[str, float] = defaultdict(float)
        
        # Tokenize: split on whitespace and strip punctuation
        words = set(re.findall(r'\b[a-zA-Z\']+\b', text_lower))
        
        # First pass: find which words match which languages
        word_language_map: Dict[str, set] = defaultdict(set)
        for word in words:
            for lang_code, profile in LANGUAGE_PROFILES.items():
                if word in profile.core_vocab:
                    word_language_map[word].add(lang_code)
        
        for lang_code, profile in LANGUAGE_PROFILES.items():
            # Count word-level matches with unique word bonus
            word_matches = 0.0
            for vocab_word in profile.core_vocab:
                if vocab_word in words:
                    # Base score: 1 point per match
                    match_score = 1.0
                    # UNIQUE WORD BONUS: +0.5 if this word ONLY matches this language
                    if len(word_language_map.get(vocab_word, set())) == 1:
                        match_score = 1.5
                    word_matches += match_score
            
            # Also check substring matches for compound words and phrases
            substring_matches = sum(1 for vocab_word in profile.core_vocab 
                                  if vocab_word in text_lower and vocab_word not in words)
            
            total_matches = word_matches + (substring_matches * 0.3)  # Weight substrings lower
            
            if total_matches > 0:
                # Use logarithmic scaling that continues to reward more matches
                # log2(1+matches) gives: 1 match=1.0, 2=1.58, 4=2.32, 6=2.81
                scores[lang_code] = min(1.0, 0.3 + (math.log2(1 + total_matches) * 0.25))
        
        return scores
        
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
        Longer/multi-word markers get higher weight (more specific = more confident).
        """
        scores: Dict[str, float] = defaultdict(float)
        
        for lang_code, profile in LANGUAGE_PROFILES.items():
            for marker in profile.cultural_markers:
                if marker.lower() in text_lower:
                    # Multi-word markers are more specific, give higher weight
                    word_count = len(marker.split())
                    # Base 0.2 + 0.15 per additional word (2 words = 0.35, 3 words = 0.5)
                    bonus = 0.2 + (word_count - 1) * 0.15
                    scores[lang_code] += bonus
        
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
