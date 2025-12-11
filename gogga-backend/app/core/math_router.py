"""
GOGGA Math Router - Intent Classification

Determines whether user queries require math tool processing.
Routes queries to appropriate math tools based on intent classification.
"""

from typing import Literal, Optional
from dataclasses import dataclass
import re
from enum import Enum


class MathCategory(str, Enum):
    """Categories of math-related queries"""
    STATISTICS = "statistics"       # Mean, median, std dev, etc.
    REGRESSION = "regression"       # Correlation, trend analysis
    FINANCIAL = "financial"         # NPV, IRR, amortization
    TAX = "tax"                     # SA income tax, VAT
    FRAUD = "fraud"                 # Benford's Law, anomalies
    PROBABILITY = "probability"     # Binomial, normal, permutations
    CONVERSION = "conversion"       # Currency, units
    NONE = "none"                   # Not math-related


@dataclass
class MathIntent:
    """Classification result for math-related queries"""
    category: MathCategory
    confidence: float       # 0.0 to 1.0
    tool_name: Optional[str]
    requires_data: bool     # Does user need to provide data?


# Keywords that trigger math routing (frozensets for O(1) lookup)
MATH_KEYWORDS: dict[str, frozenset[str]] = {
    "statistics": frozenset([
        "average", "mean", "median", "mode", "standard deviation", "std dev",
        "variance", "percentile", "quartile", "iqr", "range", "summary stats",
        "descriptive statistics", "statistical analysis", "distribution",
        "skewness", "kurtosis", "outliers", "z-score", "z score",
        "data analysis", "analyze data", "analyse data"
    ]),
    "regression": frozenset([
        "correlation", "trend", "regression", "r-squared", "r²", "forecast",
        "predict", "linear fit", "trend line", "slope", "coefficient",
        "moving average", "time series", "seasonality", "extrapolate"
    ]),
    "financial": frozenset([
        "compound interest", "simple interest", "npv", "net present value",
        "irr", "internal rate of return", "amortization", "amortisation",
        "loan payment", "monthly payment", "pmt", "present value", "future value",
        "roi", "return on investment", "break even", "cash flow", "dcf",
        "profit margin", "gross margin", "net margin", "ebitda", "bond yield",
        "mortgage", "home loan", "car finance", "vehicle finance"
    ]),
    "tax": frozenset([
        "income tax", "sars", "tax bracket", "marginal rate", "effective rate",
        "tax rebate", "primary rebate", "secondary rebate", "tertiary rebate",
        "medical credits", "tax threshold", "paye", "uif", "vat",
        "capital gains", "cgt", "provisional tax", "tax return",
        "how much tax", "calculate tax", "tax calculator"
    ]),
    "fraud": frozenset([
        "benford", "benford's law", "benfords law", "fraud detection", 
        "anomaly", "outlier detection", "red flag", "suspicious", 
        "duplicate", "round numbers", "manipulation", "forensic", 
        "audit", "irregularity", "fraud analysis"
    ]),
    "probability": frozenset([
        "probability", "binomial", "normal distribution", "poisson",
        "permutation", "combination", "factorial", "odds", "chance",
        "likelihood", "expected value", "confidence interval", "p-value",
        "hypothesis test", "t-test", "chi-square", "anova", "chi square"
    ]),
    "conversion": frozenset([
        "convert", "exchange rate", "usd to zar", "rand to dollar",
        "dollar to rand", "eur to zar", "gbp to zar",
        "celsius to fahrenheit", "fahrenheit to celsius",
        "km to miles", "miles to km", "kg to pounds", "pounds to kg",
        "meters to feet", "feet to meters", "liters to gallons"
    ]),
}


# Explicit calculation request patterns
CALC_PATTERNS = [
    r"calculate\s+(?:the\s+)?(\w+)",
    r"what(?:'s| is)\s+(?:the\s+)?(\w+)\s+of",
    r"compute\s+(?:the\s+)?(\w+)",
    r"find\s+(?:the\s+)?(\w+)\s+(?:of|for)",
    r"work out\s+(?:the\s+)?(\w+)",
    r"how much\s+(?:is|will|would)",
]


def _get_tool_for_category(category: MathCategory) -> Optional[str]:
    """Map category to tool name."""
    tool_map = {
        MathCategory.STATISTICS: "math_statistics",
        MathCategory.REGRESSION: "math_regression",
        MathCategory.FINANCIAL: "math_financial",
        MathCategory.TAX: "math_sa_tax",
        MathCategory.FRAUD: "math_fraud_analysis",
        MathCategory.PROBABILITY: "math_probability",
        MathCategory.CONVERSION: "math_conversion",
    }
    return tool_map.get(category)


def classify_math_intent(message: str) -> MathIntent:
    """
    Classify whether a message requires math tool processing.
    
    Args:
        message: User's input message
        
    Returns:
        MathIntent with classification details including category,
        confidence score, tool name, and whether data is required
    """
    message_lower = message.lower()
    
    # Track best match
    best_category = MathCategory.NONE
    best_confidence = 0.0
    
    # Check each category for keyword matches
    for category_name, keywords in MATH_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in message_lower)
        if matches > 0:
            # Calculate confidence based on keyword density
            # Max out at 3 matches = 1.0 confidence
            confidence = min(matches / 3, 1.0)
            if confidence > best_confidence:
                best_category = MathCategory(category_name)
                best_confidence = confidence
    
    # Boost confidence for explicit calculation requests
    for pattern in CALC_PATTERNS:
        if re.search(pattern, message_lower):
            if best_category == MathCategory.NONE:
                # Default to statistics for generic calc requests
                best_category = MathCategory.STATISTICS
                best_confidence = 0.5
            else:
                # Boost existing confidence
                best_confidence = min(best_confidence + 0.2, 1.0)
            break
    
    # Check for numeric data presence (comma-separated numbers)
    has_numbers = bool(re.search(r'\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+', message))
    
    # Determine if data is required
    requires_data = (
        best_category in [MathCategory.STATISTICS, MathCategory.REGRESSION, MathCategory.FRAUD]
        and not has_numbers
    )
    
    return MathIntent(
        category=best_category,
        confidence=best_confidence,
        tool_name=_get_tool_for_category(best_category),
        requires_data=requires_data
    )


def get_tier_requirement(category: MathCategory) -> str:
    """
    Get the minimum tier required for a math category.
    
    Args:
        category: The math category
        
    Returns:
        Tier name: 'free', 'jive', or 'jigga'
    """
    tier_requirements = {
        MathCategory.STATISTICS: "jive",       # Basic stats for JIVE+
        MathCategory.REGRESSION: "jigga",      # Advanced analysis JIGGA only
        MathCategory.FINANCIAL: "jive",
        MathCategory.TAX: "free",              # SA tax available to all
        MathCategory.FRAUD: "jigga",           # Fraud analysis JIGGA only
        MathCategory.PROBABILITY: "jive",
        MathCategory.CONVERSION: "free",       # Unit conversion for all
        MathCategory.NONE: "free",
    }
    return tier_requirements.get(category, "free")


def generate_data_request_prompt(intent: MathIntent) -> str:
    """
    Generate a friendly prompt asking user for required data.
    
    Args:
        intent: The classified math intent
        
    Returns:
        User-friendly prompt requesting data input
    """
    prompts = {
        MathCategory.STATISTICS: (
            "Lekker, I can help you with that analysis!\n\n"
            "Please share your numbers - you can:\n"
            "• Type them directly: `12, 45, 67, 89, 23`\n"
            "• Upload a CSV file (JIVE+ only)\n"
            "• Paste from a spreadsheet\n\n"
            "What data should I analyse?"
        ),
        MathCategory.REGRESSION: (
            "Sharp! Let's find those patterns in your data.\n\n"
            "I'll need two sets of numbers:\n"
            "• X values (independent variable)\n"
            "• Y values (dependent variable)\n\n"
            "Format: `X: 1, 2, 3, 4, 5` and `Y: 10, 20, 25, 40, 50`\n"
            "Or upload a CSV with your data columns."
        ),
        MathCategory.FRAUD: (
            "Eish, fraud detection is serious business!\n\n"
            "For Benford's Law analysis, I'll need:\n"
            "• A list of financial figures (invoices, transactions, etc.)\n"
            "• At least 100 values for meaningful results\n\n"
            "You can paste the numbers or upload a CSV."
        ),
    }
    
    return prompts.get(intent.category, "Please provide the data you'd like me to analyse.")
