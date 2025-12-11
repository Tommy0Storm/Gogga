"""
GOGGA Math Tool Definitions

OpenAI-compatible tool schemas for math operations.
These tools are executed on the backend (not frontend like chart tools).
"""

from typing import TypedDict, Any

# Define ToolDefinition locally to avoid circular import
# (definitions.py imports from here, and we can't import from definitions.py)
ToolDefinition = dict[str, Any]


# =============================================================================
# Statistics Tool
# =============================================================================

MATH_STATISTICS_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_statistics",
        "strict": True,
        "description": (
            "Perform statistical analysis on numerical data. "
            "Calculates descriptive statistics (mean, median, mode, std dev, etc.), "
            "generates summary statistics, and identifies outliers. "
            "Use this when the user wants to analyse a dataset."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The statistical operation to perform",
                    "enum": [
                        "summary",      # Full descriptive stats
                        "mean",
                        "median",
                        "mode",
                        "std_dev",
                        "variance",
                        "range",
                        "quartiles",
                        "percentile",
                        "z_scores",
                        "outliers"
                    ]
                },
                "data": {
                    "type": "array",
                    "description": "Array of numbers to analyse",
                    "items": {"type": "number"}
                },
                "percentile_value": {
                    "type": "number",
                    "description": "Percentile to calculate (0-100), only required for 'percentile' operation"
                }
            },
            "required": ["operation", "data"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Financial Tool
# =============================================================================

MATH_FINANCIAL_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_financial",
        "strict": True,
        "description": (
            "Perform financial calculations including compound interest, "
            "loan payments, NPV, IRR, and investment analysis. "
            "All monetary values are in ZAR (South African Rand)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The financial calculation to perform",
                    "enum": [
                        "compound_interest",
                        "simple_interest",
                        "loan_payment",     # PMT calculation
                        "amortization",
                        "npv",
                        "irr",
                        "present_value",
                        "future_value",
                        "roi"
                    ]
                },
                "principal": {
                    "type": "number",
                    "description": "Initial amount in ZAR (loan amount, investment, etc.)"
                },
                "rate": {
                    "type": "number",
                    "description": "Annual interest rate as decimal (e.g., 0.12 for 12%)"
                },
                "periods": {
                    "type": "number",
                    "description": "Number of years (or payment periods for amortization)"
                },
                "payment": {
                    "type": "number",
                    "description": "Regular payment amount in ZAR"
                },
                "cash_flows": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Array of cash flows for NPV/IRR (first value is initial investment as negative)"
                },
                "compound_frequency": {
                    "type": "string",
                    "enum": ["annually", "semi-annually", "quarterly", "monthly", "daily"],
                    "description": "How often interest compounds (default: monthly)"
                }
            },
            "required": ["operation"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# SA Tax Tool
# =============================================================================

MATH_SA_TAX_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_sa_tax",
        "strict": True,
        "description": (
            "Calculate South African income tax for the 2024/25 tax year. "
            "Includes PAYE, tax brackets, rebates, medical credits, and effective tax rate. "
            "Uses official SARS tax tables."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "annual_income": {
                    "type": "number",
                    "description": "Total annual taxable income in ZAR (gross salary before deductions)"
                },
                "age": {
                    "type": "integer",
                    "description": "Taxpayer's age in years (affects rebates: 65+ gets secondary, 75+ gets tertiary)"
                },
                "medical_scheme_members": {
                    "type": "integer",
                    "description": "Number of medical scheme dependants including yourself (e.g., 4 for family of 4)"
                },
                "retirement_contributions": {
                    "type": "number",
                    "description": "Annual retirement fund contributions in ZAR (pension, provident, RA)"
                }
            },
            "required": ["annual_income"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Fraud Analysis Tool
# =============================================================================

MATH_FRAUD_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_fraud_analysis",
        "strict": True,
        "description": (
            "Perform forensic analysis on financial data using Benford's Law, "
            "anomaly detection, and red flag identification. "
            "JIGGA tier only. Useful for auditing and fraud detection."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The fraud analysis operation to perform",
                    "enum": [
                        "benfords_law",         # First-digit distribution analysis
                        "find_anomalies",       # Statistical anomaly detection
                        "duplicate_check",      # Find duplicate values
                        "round_number_analysis", # Check for suspicious round numbers
                        "threshold_analysis"    # Values just under approval limits
                    ]
                },
                "data": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Financial values to analyse (invoices, transactions, etc.)"
                },
                "threshold": {
                    "type": "number",
                    "description": "Threshold value for analysis (e.g., approval limit of R10000)"
                },
                "sensitivity": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Sensitivity level for anomaly detection (low = fewer false positives)"
                }
            },
            "required": ["operation", "data"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Probability Tool
# =============================================================================

MATH_PROBABILITY_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_probability",
        "strict": True,
        "description": (
            "Calculate probabilities, combinations, permutations, and statistical tests. "
            "Useful for games of chance, statistical analysis, and hypothesis testing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The probability calculation to perform",
                    "enum": [
                        "binomial",           # Binomial probability
                        "normal_probability", # Normal distribution probability
                        "permutation",        # nPr
                        "combination",        # nCr
                        "factorial",          # n!
                        "expected_value",     # E(X)
                        "odds"                # Convert between probability and odds
                    ]
                },
                "n": {
                    "type": "integer",
                    "description": "Total number of trials or items"
                },
                "r": {
                    "type": "integer",
                    "description": "Number of successes or selections"
                },
                "p": {
                    "type": "number",
                    "description": "Probability of success (0 to 1)"
                },
                "mean": {
                    "type": "number",
                    "description": "Mean for normal distribution"
                },
                "std_dev": {
                    "type": "number",
                    "description": "Standard deviation for normal distribution"
                },
                "x": {
                    "type": "number",
                    "description": "Value to find probability for"
                },
                "values": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Values for expected value calculation"
                },
                "probabilities": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Probabilities corresponding to values"
                }
            },
            "required": ["operation"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Conversion Tool
# =============================================================================

MATH_CONVERSION_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_conversion",
        "strict": True,
        "description": (
            "Convert between units of measurement. "
            "Includes temperature, distance, weight, volume, and currency. "
            "Currency rates are approximate and for reference only."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "value": {
                    "type": "number",
                    "description": "The value to convert"
                },
                "from_unit": {
                    "type": "string",
                    "description": "The unit to convert from",
                    "enum": [
                        "celsius", "fahrenheit", "kelvin",
                        "km", "miles", "meters", "feet", "inches", "cm",
                        "kg", "pounds", "grams", "ounces",
                        "liters", "gallons", "ml",
                        "zar", "usd", "eur", "gbp"
                    ]
                },
                "to_unit": {
                    "type": "string",
                    "description": "The unit to convert to",
                    "enum": [
                        "celsius", "fahrenheit", "kelvin",
                        "km", "miles", "meters", "feet", "inches", "cm",
                        "kg", "pounds", "grams", "ounces",
                        "liters", "gallons", "ml",
                        "zar", "usd", "eur", "gbp"
                    ]
                }
            },
            "required": ["value", "from_unit", "to_unit"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Tool Registry
# =============================================================================

MATH_TOOLS = [
    MATH_STATISTICS_TOOL,
    MATH_FINANCIAL_TOOL,
    MATH_SA_TAX_TOOL,
    MATH_FRAUD_TOOL,
    MATH_PROBABILITY_TOOL,
    MATH_CONVERSION_TOOL,
]


def get_math_tools_for_tier(tier: str) -> list[ToolDefinition]:
    """
    Get math tools available for a specific tier.
    
    Args:
        tier: User tier ('free', 'jive', 'jigga')
        
    Returns:
        List of tool definitions available for the tier
    """
    tier_lower = tier.lower()
    
    # FREE tier: tax and conversion only
    if tier_lower == "free":
        return [MATH_SA_TAX_TOOL, MATH_CONVERSION_TOOL]
    
    # JIVE tier: add statistics, financial, probability
    if tier_lower == "jive":
        return [
            MATH_STATISTICS_TOOL,
            MATH_FINANCIAL_TOOL,
            MATH_SA_TAX_TOOL,
            MATH_PROBABILITY_TOOL,
            MATH_CONVERSION_TOOL,
        ]
    
    # JIGGA tier: all tools including fraud analysis
    return MATH_TOOLS


# Pre-defined tool lists for each tier (for import into definitions.py)
FREE_MATH_TOOLS: list[ToolDefinition] = [MATH_SA_TAX_TOOL, MATH_CONVERSION_TOOL]

JIVE_MATH_TOOLS: list[ToolDefinition] = [
    MATH_STATISTICS_TOOL,
    MATH_FINANCIAL_TOOL,
    MATH_SA_TAX_TOOL,
    MATH_PROBABILITY_TOOL,
    MATH_CONVERSION_TOOL,
]

JIGGA_MATH_TOOLS: list[ToolDefinition] = MATH_TOOLS  # All tools including fraud
