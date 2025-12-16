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
# Python Executor Tool (Python 3.14 Features)
# =============================================================================

PYTHON_EXECUTOR_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "python_execute",
        "strict": True,
        "description": (
            "Execute Python code for complex mathematical calculations, data analysis, "
            "or any computation that requires precision. Uses Python 3.14 with features like "
            "Decimal.from_number(), Fraction.from_number(), template strings, and improved formatting. "
            "Available: math, decimal, fractions, statistics, numpy, scipy, AND SYMPY for symbolic math. "
            "SymPy provides: solve(), diff(), integrate(), limit(), series(), Matrix operations, "
            "Symbol, Eq, simplify, expand, factor, latex() for equation rendering. "
            "Returns formatted terminal-style output with syntax highlighting. "
            "Use this for: algebraic expressions, symbolic math, solving equations, calculus, "
            "matrix operations, custom formulas, iterative calculations, or when other math tools don't fit."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": (
                        "Python code to execute. Must print results to stdout. "
                        "Available pre-imported: math, Decimal, Fraction, statistics, numpy (np), scipy, "
                        "and all SymPy functions (Symbol, symbols, solve, diff, integrate, limit, "
                        "series, Eq, simplify, expand, factor, Matrix, det, inv, latex, pretty, "
                        "sin, cos, tan, exp, log, sqrt, pi, E, I, oo). "
                        "Example symbolic: 'x = Symbol(\"x\"); eq = x**2 - 4; print(f\"Solutions: {solve(eq, x)}\")' "
                        "Example calculus: 'x = Symbol(\"x\"); f = x**3; print(f\"Derivative: {diff(f, x)}, Integral: {integrate(f, x)}\")'"
                    )
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of what the code calculates (shown to user)"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Execution timeout in seconds (default: 10, max: 30)"
                }
            },
            "required": ["code", "description"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Sequential Thinking Tool - Multi-step reasoning for complex problems
# =============================================================================

SEQUENTIAL_THINKING_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "sequential_think",
        "strict": True,
        "description": (
            "Think through a complex problem step by step, recording intermediate results. "
            "Use this when a problem requires multiple calculation steps, and you want to: "
            "1) Break down the problem into logical steps, 2) Store intermediate results for later steps, "
            "3) Build up to a final answer incrementally, 4) Show the user your reasoning process. "
            "IMPORTANT: You can call this tool multiple times in sequence to work through complex problems. "
            "Each call represents ONE step in your reasoning chain. Set 'needs_more_steps' to true if "
            "there are additional steps to perform, or false when you reach the final answer. "
            "The LLM can choose to perform calculations in the 'calculation' field (optional) "
            "or use other tools like python_execute between sequential_think calls for complex math."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "step_number": {
                    "type": "integer",
                    "description": "Current step number (start from 1, increment each call)"
                },
                "thought": {
                    "type": "string",
                    "description": "Explanation of what you're doing in this step and why"
                },
                "calculation": {
                    "type": "string",
                    "description": "Optional: Simple calculation performed in this step (e.g., '5 * 12 = 60')"
                },
                "intermediate_result": {
                    "type": "string",
                    "description": "The result or output from this step that will be used in subsequent steps"
                },
                "needs_more_steps": {
                    "type": "boolean",
                    "description": "Set to true if more steps are needed, false if this is the final step"
                },
                "next_step_plan": {
                    "type": "string",
                    "description": "If needs_more_steps is true, briefly describe what the next step will do"
                }
            },
            "required": ["step_number", "thought", "intermediate_result", "needs_more_steps"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Math Delegate Tool - 235B delegates computation to 32B
# =============================================================================

MATH_DELEGATE_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_delegate",
        "strict": True,
        "description": (
            "Delegate a mathematical computation to the fast math processor (Qwen 32B + SymPy). "
            "Use this when you need to compute something mathematically but want to focus on "
            "understanding and explaining the results. Describe WHAT to calculate in natural language, "
            "not HOW to code it. The fast processor will write and execute the SymPy code, "
            "then return the computed result for you to interpret and explain to the user. "
            "This is ideal for: solving equations, calculus operations, matrix computations, "
            "differential equations, symbolic manipulation, or any computation where you want "
            "to focus on the explanation rather than the implementation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": (
                        "Natural language description of the math task. Be specific about: "
                        "1) What mathematical operation to perform, "
                        "2) The exact values/expressions involved, "
                        "3) What format you want the result in. "
                        "Example: 'Find the eigenvalues and eigenvectors of the matrix [[1,2],[3,4]]' "
                        "Example: 'Solve the differential equation dy/dx = x*y with y(0) = 1' "
                        "Example: 'Calculate the integral of x^2 * sin(x) from 0 to pi'"
                    )
                },
                "context": {
                    "type": "string",
                    "description": "Optional context about why this calculation is needed or how it fits into the larger problem"
                }
            },
            "required": ["task"],
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
    PYTHON_EXECUTOR_TOOL,
    SEQUENTIAL_THINKING_TOOL,
]

# Tools available for 235B model (includes delegation to 32B)
MATH_TOOLS_235B = MATH_TOOLS + [MATH_DELEGATE_TOOL]

# Set of all math tool names for filtering (used to identify math tools in ai_service)
ALL_MATH_TOOL_NAMES: set[str] = {
    "math_statistics",
    "math_financial",
    "math_sa_tax",
    "math_fraud_analysis",
    "math_probability",
    "math_conversion",
    "python_execute",
    "sequential_think",
    "math_delegate",
}


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
    
    # JIVE tier: add statistics, financial, probability, python executor
    if tier_lower == "jive":
        return [
            MATH_STATISTICS_TOOL,
            MATH_FINANCIAL_TOOL,
            MATH_SA_TAX_TOOL,
            MATH_PROBABILITY_TOOL,
            MATH_CONVERSION_TOOL,
            PYTHON_EXECUTOR_TOOL,
        ]
    
    # JIGGA tier: all tools including fraud analysis and python executor
    return MATH_TOOLS


# Pre-defined tool lists for each tier (for import into definitions.py)
FREE_MATH_TOOLS: list[ToolDefinition] = [MATH_SA_TAX_TOOL, MATH_CONVERSION_TOOL]

JIVE_MATH_TOOLS: list[ToolDefinition] = [
    MATH_STATISTICS_TOOL,
    MATH_FINANCIAL_TOOL,
    MATH_SA_TAX_TOOL,
    MATH_PROBABILITY_TOOL,
    MATH_CONVERSION_TOOL,
    PYTHON_EXECUTOR_TOOL,
    SEQUENTIAL_THINKING_TOOL,  # For multi-step reasoning
]

# JIGGA 32B default: All tools including fraud + python + thinking
JIGGA_MATH_TOOLS: list[ToolDefinition] = MATH_TOOLS

# JIGGA 235B: All tools + math_delegate for delegating to 32B
JIGGA_235B_MATH_TOOLS: list[ToolDefinition] = MATH_TOOLS_235B
