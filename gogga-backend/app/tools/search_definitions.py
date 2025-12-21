"""
GOGGA Search Tool Definitions - Web Search with AI Processing

This module defines the search tool for AI function calling.
Integrates Serper.dev search with automatic page scraping and
structures results for Qwen/LLM processing.
"""
from typing import Any

# Tool definition for AI function calling
SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "strict": True,
        "description": (
            "Search the web for current information using Google Search. "
            "Use this tool when you need up-to-date information that may not be in your training data, "
            "such as: recent news, current prices, legal precedents, job listings, weather, sports scores, "
            "product availability, or any time-sensitive information. "
            "The search is optimized for South African context but works globally. "
            "Results include page summaries and full content where available."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query. Be specific and include relevant context. Examples: 'CCMA unfair dismissal procedure 2024', 'Nike Air Max 90 price South Africa', 'load shedding schedule Cape Town today'"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to fetch (1-10). Use fewer for speed, more for comprehensive research.",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 10
                },
                "time_filter": {
                    "type": "string",
                    "description": "Filter results by time. Use for recent information.",
                    "enum": ["day", "week", "month", "year", "any"],
                    "default": "any"
                },
                "scrape_content": {
                    "type": "boolean",
                    "description": "Whether to fetch full page content (slower but more detailed). Set to false for quick summaries only.",
                    "default": True
                },
                "language": {
                    "type": "string",
                    "description": "Preferred language for results. SA languages supported.",
                    "enum": ["en", "af", "zu", "xh", "st", "tn", "ts", "ss", "ve", "nr", "nso"],
                    "default": "en"
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
}

# Legal-specific search tool
LEGAL_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "legal_search",
        "strict": True,
        "description": (
            "Search for South African legal information including case law, legislation, "
            "CCMA rulings, Labour Court decisions, and legal commentary. "
            "Use this for employment law, consumer protection, constitutional matters, etc. "
            "Automatically searches legal databases and SA legal news sources."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Legal search query. Include relevant acts, case names, or legal concepts. Examples: 'automatically unfair dismissal LRA section 187', 'POPIA data breach penalties', 'CCMA reinstatement vs compensation'"
                },
                "case_law": {
                    "type": "boolean",
                    "description": "Focus on case law and court decisions",
                    "default": True
                },
                "legislation": {
                    "type": "boolean",
                    "description": "Include legislation and acts",
                    "default": True
                },
                "time_filter": {
                    "type": "string",
                    "description": "Filter by time for recent developments",
                    "enum": ["day", "week", "month", "year", "any"],
                    "default": "any"
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
}

# Shopping/price search tool
SHOPPING_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "shopping_search",
        "strict": True,
        "description": (
            "Search for products and prices in South Africa. "
            "Finds current prices, availability, and deals from SA retailers. "
            "Supports electronics, clothing, groceries, and more."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Product search query. Be specific about model, size, color, etc. Examples: 'iPhone 15 Pro Max 256GB price', 'Nike Air Force 1 white size 10', 'Samsung 55 inch TV Takealot'"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results (1-10)",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 10
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
}


# Places/Location search tool - uses Serper.dev Places API
PLACES_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "places_search",
        "strict": True,
        "description": (
            "Search for nearby places, businesses, restaurants, shops, and services. "
            "Returns detailed information including addresses, ratings, phone numbers, and websites. "
            "Use this when users ask for recommendations, directions, 'near me' queries, or 'nearest' queries. "
            "IMPORTANT: If the user's message includes [User Location Context], extract the location from there "
            "and use it in the 'location' parameter. For example, if context says 'Location: Pretoriuspark, Pretoria, South Africa', "
            "use 'Pretoria, South Africa' as the location. "
            "Examples: 'petrol stations near me', 'plumbers in Sandton', 'hospitals in Durban', "
            "'best coffee shops Cape Town CBD', 'Pick n Pay stores nearby', 'nearest petrol station'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for. Include the type of place. Examples: 'petrol stations', 'pharmacies', 'restaurants Italian'"
                },
                "location": {
                    "type": "string",
                    "description": "Specific location for the search. MUST be extracted from [User Location Context] if available, or from the user's message. Use format 'City, Country' or 'Suburb, City'. Examples: 'Pretoria, South Africa', 'Sandton, Johannesburg', 'Umhlanga, Durban'",
                    "default": "South Africa"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of places to return (1-20)",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
}


# All search tools
SEARCH_TOOLS = [SEARCH_TOOL, LEGAL_SEARCH_TOOL, SHOPPING_SEARCH_TOOL, PLACES_SEARCH_TOOL]


def get_search_tools(tier: str = "jive") -> list[dict]:
    """
    Get search tools available for a tier.
    
    Args:
        tier: User tier (free, jive, jigga)
        
    Returns:
        List of tool definitions
    """
    if tier == "free":
        # FREE tier gets basic search and places
        return [SEARCH_TOOL, PLACES_SEARCH_TOOL]
    else:
        # Paid tiers get all search tools
        return SEARCH_TOOLS


# =============================================================================
# South African Language Code Mapping
# =============================================================================

# Serper.dev uses Google's hl (host language) parameter
# These map SA official languages to closest Google language codes
SA_LANGUAGE_CODES = {
    "en": "en",      # English
    "af": "af",      # Afrikaans
    "zu": "zu",      # Zulu - Google supports
    "xh": "xh",      # Xhosa - Google supports
    "st": "st",      # Sotho (Sesotho) - Google supports
    "tn": "tn",      # Tswana (Setswana) - limited support, fallback to st
    "ts": "ts",      # Tsonga (Xitsonga) - limited, fallback to en
    "ss": "ss",      # Swazi (siSwati) - limited, fallback to zu
    "ve": "ve",      # Venda (Tshivenda) - limited, fallback to en
    "nr": "nr",      # Ndebele (isiNdebele) - limited, fallback to zu
    "nso": "nso",    # Northern Sotho (Sepedi) - limited, fallback to st
}

# Fallback mapping for languages with limited Google support
SA_LANGUAGE_FALLBACKS = {
    "tn": "st",   # Tswana → Sotho (same family)
    "ts": "en",   # Tsonga → English
    "ss": "zu",   # Swazi → Zulu (similar)
    "ve": "en",   # Venda → English
    "nr": "zu",   # Ndebele → Zulu (similar)
    "nso": "st",  # Northern Sotho → Sotho
}


def get_serper_language_code(lang_code: str) -> str:
    """
    Convert SA language code to Serper.dev/Google language code.
    
    Args:
        lang_code: SA language code (en, af, zu, xh, st, tn, ts, ss, ve, nr, nso)
        
    Returns:
        Google-compatible language code for Serper.dev hl parameter
    """
    # Get the language code (use fallback if needed)
    code = lang_code.lower()
    
    # Check if it's a supported SA language
    if code in SA_LANGUAGE_CODES:
        # Check if we need to use a fallback
        if code in SA_LANGUAGE_FALLBACKS:
            return SA_LANGUAGE_FALLBACKS[code]
        return SA_LANGUAGE_CODES[code]
    
    # Default to English
    return "en"


TIME_FILTER_MAP = {
    "day": "qdr:d",
    "week": "qdr:w",
    "month": "qdr:m",
    "year": "qdr:y",
    "any": None,
}


def parse_time_filter(filter_str: str) -> str | None:
    """Convert human-readable time filter to Serper format."""
    return TIME_FILTER_MAP.get(filter_str.lower(), None)
