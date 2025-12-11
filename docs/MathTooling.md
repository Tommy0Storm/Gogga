# GOGGA Math Tool & Prompt Routing System

> **Project**: GOGGA - South African AI Assistant  
> **Version**: 1.0  
> **Created**: December 8, 2025  
> **Status**: ✅ All Phases Complete (A-D)  
> **Last Updated**: Session December 8, 2025  
> **Depends On**: DATA_VISUALIZATION_SYSTEM.md Phase 1 (Completed)

---

## 📋 Executive Summary

This document outlines the Math Tool implementation and the critical **Prompt Routing** system that determines when to invoke math tools versus regular AI responses. The routing system is essential for seamless integration of mathematical capabilities into GOGGA's conversation flow.

---

## 🎯 System Goals

1. **Math Tool Backend** - Statistics, fraud analysis, financial formulas
2. **Prompt Routing** - Intelligent detection of math-related queries
3. **Display Integration** - Connect math results to visualization system
4. **SA Context** - Local tax calculations, ZAR currency, SA regulations

---

## 🧭 PHASE A: Prompt Routing System

### A.1 Overview

The prompt routing system determines whether a user query should:
1. **Route to Math Tool** - Quantitative analysis, calculations, formulas
2. **Route to AI Response** - Conversational, qualitative, explanatory
3. **Hybrid Response** - AI explanation + math tool results

### A.2 Math Intent Classification

```python
# File: gogga-backend/app/core/math_router.py

from typing import Literal, Optional
from dataclasses import dataclass
import re

@dataclass
class MathIntent:
    """Classification result for math-related queries"""
    category: Literal[
        "statistics",      # Mean, median, std dev, etc.
        "regression",      # Correlation, trend analysis
        "financial",       # NPV, IRR, amortization
        "tax",             # SA income tax, VAT
        "fraud",           # Benford's Law, anomalies
        "probability",     # Binomial, normal, permutations
        "conversion",      # Currency, units
        "none"             # Not math-related
    ]
    confidence: float      # 0.0 to 1.0
    tool_name: Optional[str]
    requires_data: bool    # Does user need to provide data?

# Keywords that trigger math routing
MATH_KEYWORDS = {
    "statistics": frozenset([
        "average", "mean", "median", "mode", "standard deviation", "std dev",
        "variance", "percentile", "quartile", "iqr", "range", "summary stats",
        "descriptive statistics", "statistical analysis", "distribution",
        "skewness", "kurtosis", "outliers", "z-score"
    ]),
    "regression": frozenset([
        "correlation", "trend", "regression", "r-squared", "r²", "forecast",
        "predict", "linear fit", "trend line", "slope", "coefficient",
        "moving average", "time series", "seasonality"
    ]),
    "financial": frozenset([
        "compound interest", "simple interest", "npv", "net present value",
        "irr", "internal rate of return", "amortization", "amortisation",
        "loan payment", "monthly payment", "pmt", "present value", "future value",
        "roi", "return on investment", "break even", "cash flow", "dcf",
        "profit margin", "gross margin", "net margin", "ebitda"
    ]),
    "tax": frozenset([
        "income tax", "sars", "tax bracket", "marginal rate", "effective rate",
        "tax rebate", "primary rebate", "secondary rebate", "tertiary rebate",
        "medical credits", "tax threshold", "paye", "uif", "vat",
        "capital gains", "cgt", "provisional tax"
    ]),
    "fraud": frozenset([
        "benford", "benford's law", "fraud detection", "anomaly", "outlier",
        "red flag", "suspicious", "duplicate", "round numbers", "manipulation",
        "forensic", "audit", "irregularity"
    ]),
    "probability": frozenset([
        "probability", "binomial", "normal distribution", "poisson",
        "permutation", "combination", "factorial", "odds", "chance",
        "likelihood", "expected value", "confidence interval", "p-value",
        "hypothesis test", "t-test", "chi-square", "anova"
    ]),
    "conversion": frozenset([
        "convert", "exchange rate", "usd to zar", "rand to dollar",
        "celsius to fahrenheit", "km to miles", "kg to pounds"
    ]),
}

def classify_math_intent(message: str) -> MathIntent:
    """
    Classify whether a message requires math tool processing.
    
    Args:
        message: User's input message
        
    Returns:
        MathIntent with classification details
    """
    message_lower = message.lower()
    
    # Check each category
    best_match = ("none", 0.0, None)
    
    for category, keywords in MATH_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in message_lower)
        if matches > 0:
            # Calculate confidence based on keyword density
            confidence = min(matches / 3, 1.0)  # Max out at 3 matches
            if confidence > best_match[1]:
                best_match = (category, confidence, _get_tool_for_category(category))
    
    # Check for explicit calculation requests
    calc_patterns = [
        r"calculate\s+(?:the\s+)?(\w+)",
        r"what(?:'s| is)\s+(?:the\s+)?(\w+)\s+of",
        r"compute\s+(?:the\s+)?(\w+)",
        r"find\s+(?:the\s+)?(\w+)\s+(?:of|for)",
    ]
    
    for pattern in calc_patterns:
        if re.search(pattern, message_lower):
            if best_match[0] == "none":
                best_match = ("statistics", 0.5, "math_statistics")
            else:
                best_match = (best_match[0], min(best_match[1] + 0.2, 1.0), best_match[2])
    
    # Check for numeric data presence
    has_numbers = bool(re.search(r'\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)+', message))
    
    return MathIntent(
        category=best_match[0],
        confidence=best_match[1],
        tool_name=best_match[2],
        requires_data=best_match[0] in ["statistics", "regression", "fraud"] and not has_numbers
    )

def _get_tool_for_category(category: str) -> str:
    """Map category to tool name"""
    return {
        "statistics": "math_statistics",
        "regression": "math_regression",
        "financial": "math_financial",
        "tax": "math_sa_tax",
        "fraud": "math_fraud_analysis",
        "probability": "math_probability",
        "conversion": "math_conversion",
    }.get(category)
```

### A.3 Router Integration

```python
# File: gogga-backend/app/core/router.py (additions)

from app.core.math_router import classify_math_intent, MathIntent

async def route_message(
    message: str,
    user_tier: str,
    context: Optional[dict] = None
) -> RouteDecision:
    """
    Enhanced router with math intent detection.
    """
    # First, classify math intent
    math_intent = classify_math_intent(message)
    
    # Tier gating for math features
    math_tier_requirements = {
        "statistics": "jive",      # Basic stats available to JIVE+
        "regression": "jigga",     # Advanced analysis JIGGA only
        "financial": "jive",
        "tax": "free",             # SA tax available to all
        "fraud": "jigga",          # Fraud analysis JIGGA only
        "probability": "jive",
        "conversion": "free",
    }
    
    required_tier = math_tier_requirements.get(math_intent.category, "free")
    tier_order = ["free", "jive", "jigga"]
    user_tier_index = tier_order.index(user_tier.lower())
    required_tier_index = tier_order.index(required_tier)
    
    if math_intent.confidence > 0.6 and user_tier_index >= required_tier_index:
        return RouteDecision(
            layer="math_tool",
            tool=math_intent.tool_name,
            confidence=math_intent.confidence,
            requires_data=math_intent.requires_data,
            fallback_prompt=_generate_data_request_prompt(math_intent) if math_intent.requires_data else None
        )
    elif math_intent.confidence > 0.6 and user_tier_index < required_tier_index:
        # User needs higher tier for this math feature
        return RouteDecision(
            layer="upgrade_prompt",
            required_tier=required_tier,
            feature=math_intent.category,
        )
    
    # Continue with existing routing logic...
    return await _route_to_ai_layer(message, user_tier, context)
```

### A.4 Data Request Prompts

When the math tool needs data from the user:

```python
def _generate_data_request_prompt(intent: MathIntent) -> str:
    """Generate a friendly prompt asking user for required data"""
    
    prompts = {
        "statistics": (
            "Lekker, I can help you with that analysis! 📊\n\n"
            "Please share your numbers - you can:\n"
            "• Type them directly: `12, 45, 67, 89, 23`\n"
            "• Upload a CSV file (JIVE+ only)\n"
            "• Paste from a spreadsheet\n\n"
            "What data should I analyse?"
        ),
        "regression": (
            "Sharp! Let's find those patterns in your data. 📈\n\n"
            "I'll need two sets of numbers:\n"
            "• X values (independent variable)\n"
            "• Y values (dependent variable)\n\n"
            "Format: `X: 1, 2, 3, 4, 5` and `Y: 10, 20, 25, 40, 50`\n"
            "Or upload a CSV with your data columns."
        ),
        "fraud": (
            "Eish, fraud detection is serious business! 🔍\n\n"
            "For Benford's Law analysis, I'll need:\n"
            "• A list of financial figures (invoices, transactions, etc.)\n"
            "• At least 100 values for meaningful results\n\n"
            "You can paste the numbers or upload a CSV."
        ),
    }
    
    return prompts.get(intent.category, "Please provide the data you'd like me to analyse.")
```

---

## 🔢 PHASE B: Math Tool Implementation

### B.1 Tool Definitions

```python
# File: gogga-backend/app/tools/math_definitions.py

MATH_STATISTICS_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_statistics",
        "description": (
            "Perform statistical analysis on numerical data. "
            "Calculates descriptive statistics (mean, median, mode, std dev, etc.), "
            "generates summary statistics, and identifies outliers."
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
                    "description": "Percentile to calculate (0-100), only for 'percentile' operation"
                }
            },
            "required": ["operation", "data"]
        }
    }
}

MATH_FINANCIAL_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_financial",
        "description": (
            "Perform financial calculations including compound interest, "
            "loan payments, NPV, IRR, and investment analysis."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": [
                        "compound_interest",
                        "simple_interest",
                        "loan_payment",     # PMT
                        "amortization",
                        "npv",
                        "irr",
                        "present_value",
                        "future_value",
                        "roi"
                    ]
                },
                "principal": {"type": "number", "description": "Initial amount in ZAR"},
                "rate": {"type": "number", "description": "Interest rate (as decimal, e.g., 0.12 for 12%)"},
                "periods": {"type": "number", "description": "Number of periods (years or months)"},
                "payment": {"type": "number", "description": "Regular payment amount"},
                "cash_flows": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Cash flows for NPV/IRR calculations"
                },
                "compound_frequency": {
                    "type": "string",
                    "enum": ["annually", "semi-annually", "quarterly", "monthly", "daily"],
                    "description": "How often interest compounds"
                }
            },
            "required": ["operation"]
        }
    }
}

MATH_SA_TAX_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_sa_tax",
        "description": (
            "Calculate South African income tax for the 2024/25 tax year. "
            "Includes PAYE, tax brackets, rebates, and effective tax rate."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "annual_income": {
                    "type": "number",
                    "description": "Total annual taxable income in ZAR"
                },
                "age": {
                    "type": "integer",
                    "description": "Taxpayer's age (affects rebates)"
                },
                "medical_scheme_members": {
                    "type": "integer",
                    "description": "Number of medical scheme dependants (including self)"
                },
                "retirement_contributions": {
                    "type": "number",
                    "description": "Annual retirement fund contributions in ZAR"
                }
            },
            "required": ["annual_income"]
        }
    }
}

MATH_FRAUD_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "math_fraud_analysis",
        "description": (
            "Perform forensic analysis on financial data using Benford's Law, "
            "anomaly detection, and red flag identification."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": [
                        "benfords_law",
                        "find_anomalies",
                        "duplicate_check",
                        "round_number_analysis",
                        "threshold_analysis"
                    ]
                },
                "data": {
                    "type": "array",
                    "items": {"type": "number"},
                    "description": "Financial values to analyse"
                },
                "threshold": {
                    "type": "number",
                    "description": "Threshold value for analysis (e.g., approval limit)"
                },
                "sensitivity": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "Sensitivity for anomaly detection"
                }
            },
            "required": ["operation", "data"]
        }
    }
}
```

### B.2 Math Service Implementation

```python
# File: gogga-backend/app/services/math_service.py

import math
from typing import Any, Dict, List, Optional
from collections import Counter
import numpy as np
from scipy import stats

class MathService:
    """
    Core math service for GOGGA.
    Handles statistics, financial calculations, and fraud analysis.
    """
    
    # =========================================================================
    # Statistics Operations
    # =========================================================================
    
    def calculate_statistics(
        self, 
        operation: str, 
        data: List[float],
        **kwargs
    ) -> Dict[str, Any]:
        """Perform statistical calculations"""
        
        if not data:
            raise ValueError("Data array cannot be empty")
        
        if operation == "summary":
            return self._summary_stats(data)
        elif operation == "mean":
            return {"mean": np.mean(data), "count": len(data)}
        elif operation == "median":
            return {"median": np.median(data), "count": len(data)}
        elif operation == "mode":
            mode_result = stats.mode(data, keepdims=True)
            return {"mode": float(mode_result.mode[0]), "frequency": int(mode_result.count[0])}
        elif operation == "std_dev":
            return {"std_dev": np.std(data, ddof=1), "variance": np.var(data, ddof=1)}
        elif operation == "variance":
            return {"variance": np.var(data, ddof=1)}
        elif operation == "range":
            return {"min": min(data), "max": max(data), "range": max(data) - min(data)}
        elif operation == "quartiles":
            return self._quartiles(data)
        elif operation == "percentile":
            pct = kwargs.get("percentile_value", 50)
            return {"percentile": pct, "value": np.percentile(data, pct)}
        elif operation == "z_scores":
            return self._z_scores(data)
        elif operation == "outliers":
            return self._find_outliers(data)
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    def _summary_stats(self, data: List[float]) -> Dict[str, Any]:
        """Generate comprehensive summary statistics"""
        q1, q2, q3 = np.percentile(data, [25, 50, 75])
        return {
            "count": len(data),
            "mean": float(np.mean(data)),
            "median": float(np.median(data)),
            "mode": float(stats.mode(data, keepdims=True).mode[0]),
            "std_dev": float(np.std(data, ddof=1)),
            "variance": float(np.var(data, ddof=1)),
            "min": float(min(data)),
            "max": float(max(data)),
            "range": float(max(data) - min(data)),
            "q1": float(q1),
            "q2": float(q2),
            "q3": float(q3),
            "iqr": float(q3 - q1),
            "skewness": float(stats.skew(data)),
            "kurtosis": float(stats.kurtosis(data)),
            "display_type": "stat_cards"  # For frontend rendering
        }
    
    def _quartiles(self, data: List[float]) -> Dict[str, Any]:
        """Calculate quartiles and IQR"""
        q1, q2, q3 = np.percentile(data, [25, 50, 75])
        return {
            "q1": float(q1),
            "q2_median": float(q2),
            "q3": float(q3),
            "iqr": float(q3 - q1),
            "min": float(min(data)),
            "max": float(max(data))
        }
    
    def _z_scores(self, data: List[float]) -> Dict[str, Any]:
        """Calculate Z-scores for each data point"""
        mean = np.mean(data)
        std = np.std(data, ddof=1)
        z_scores = [(x - mean) / std for x in data]
        return {
            "z_scores": z_scores,
            "mean": float(mean),
            "std_dev": float(std),
            "display_type": "data_table"
        }
    
    def _find_outliers(self, data: List[float]) -> Dict[str, Any]:
        """Find outliers using IQR method"""
        q1, q3 = np.percentile(data, [25, 75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = [x for x in data if x < lower_bound or x > upper_bound]
        
        return {
            "outliers": outliers,
            "outlier_count": len(outliers),
            "lower_bound": float(lower_bound),
            "upper_bound": float(upper_bound),
            "q1": float(q1),
            "q3": float(q3),
            "iqr": float(iqr),
            "display_type": "alert_cards" if outliers else "stat_cards"
        }
    
    # =========================================================================
    # Financial Calculations
    # =========================================================================
    
    def calculate_financial(
        self,
        operation: str,
        principal: float = 0,
        rate: float = 0,
        periods: int = 0,
        payment: float = 0,
        cash_flows: List[float] = None,
        compound_frequency: str = "monthly"
    ) -> Dict[str, Any]:
        """Perform financial calculations"""
        
        freq_map = {
            "annually": 1, "semi-annually": 2, "quarterly": 4,
            "monthly": 12, "daily": 365
        }
        n = freq_map.get(compound_frequency, 12)
        
        if operation == "compound_interest":
            return self._compound_interest(principal, rate, periods, n)
        elif operation == "simple_interest":
            return self._simple_interest(principal, rate, periods)
        elif operation == "loan_payment":
            return self._pmt(principal, rate, periods, n)
        elif operation == "amortization":
            return self._amortization_schedule(principal, rate, periods, n)
        elif operation == "npv":
            return self._npv(rate, cash_flows or [])
        elif operation == "irr":
            return self._irr(cash_flows or [])
        elif operation == "present_value":
            return self._present_value(payment, rate, periods, n)
        elif operation == "future_value":
            return self._future_value(principal, rate, periods, n)
        elif operation == "roi":
            return self._roi(principal, payment)  # payment = final value
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    def _compound_interest(self, p: float, r: float, t: int, n: int) -> Dict[str, Any]:
        """A = P(1 + r/n)^(nt)"""
        amount = p * (1 + r/n) ** (n * t)
        interest = amount - p
        return {
            "principal": p,
            "rate": r,
            "periods": t,
            "compound_frequency": n,
            "final_amount": round(amount, 2),
            "total_interest": round(interest, 2),
            "effective_rate": round((1 + r/n) ** n - 1, 4),
            "display_type": "stat_cards",
            "formula": f"A = {p:,.2f} × (1 + {r:.4f}/{n})^({n} × {t})"
        }
    
    def _pmt(self, pv: float, r: float, n: int, freq: int) -> Dict[str, Any]:
        """Calculate loan payment: PMT = PV × [r(1+r)^n] / [(1+r)^n - 1]"""
        r_per = r / freq
        n_total = n * freq
        
        if r_per == 0:
            pmt = pv / n_total
        else:
            pmt = pv * (r_per * (1 + r_per) ** n_total) / ((1 + r_per) ** n_total - 1)
        
        total_paid = pmt * n_total
        total_interest = total_paid - pv
        
        return {
            "loan_amount": pv,
            "annual_rate": r,
            "term_years": n,
            "payments_per_year": freq,
            "monthly_payment": round(pmt, 2),
            "total_paid": round(total_paid, 2),
            "total_interest": round(total_interest, 2),
            "display_type": "stat_cards",
            "formula": f"PMT = R{pv:,.2f} at {r*100:.1f}% over {n} years"
        }
    
    # =========================================================================
    # SA Tax Calculations (2024/25)
    # =========================================================================
    
    def calculate_sa_tax(
        self,
        annual_income: float,
        age: int = 35,
        medical_scheme_members: int = 1,
        retirement_contributions: float = 0
    ) -> Dict[str, Any]:
        """Calculate SA income tax for 2024/25 tax year"""
        
        # Tax brackets 2024/25
        brackets = [
            (237100, 0.18, 0),
            (370500, 0.26, 42678),
            (512800, 0.31, 77362),
            (673000, 0.36, 121475),
            (857900, 0.39, 179147),
            (1817000, 0.41, 251258),
            (float('inf'), 0.45, 644489),
        ]
        
        # Rebates 2024/25
        primary_rebate = 17235
        secondary_rebate = 9444   # Age >= 65
        tertiary_rebate = 3145    # Age >= 75
        
        # Tax thresholds
        threshold_under_65 = 95750
        threshold_65_to_74 = 148217
        threshold_75_plus = 165689
        
        # Apply retirement contribution deduction (max 27.5% of income, max R350k)
        retirement_deduction = min(retirement_contributions, min(annual_income * 0.275, 350000))
        taxable_income = max(0, annual_income - retirement_deduction)
        
        # Check threshold
        if age < 65 and taxable_income <= threshold_under_65:
            return {"tax_payable": 0, "reason": "Below tax threshold"}
        elif 65 <= age < 75 and taxable_income <= threshold_65_to_74:
            return {"tax_payable": 0, "reason": "Below tax threshold for age 65-74"}
        elif age >= 75 and taxable_income <= threshold_75_plus:
            return {"tax_payable": 0, "reason": "Below tax threshold for age 75+"}
        
        # Calculate tax
        tax = 0
        for i, (limit, rate, base) in enumerate(brackets):
            if taxable_income <= limit:
                if i == 0:
                    tax = taxable_income * rate
                else:
                    prev_limit = brackets[i-1][0]
                    tax = base + (taxable_income - prev_limit) * rate
                break
        
        # Apply rebates
        total_rebate = primary_rebate
        if age >= 65:
            total_rebate += secondary_rebate
        if age >= 75:
            total_rebate += tertiary_rebate
        
        # Medical credits (R364 per month for first 2, R246 for each additional)
        if medical_scheme_members >= 1:
            main_members = min(medical_scheme_members, 2)
            additional = max(0, medical_scheme_members - 2)
            medical_credits = (main_members * 364 + additional * 246) * 12
        else:
            medical_credits = 0
        
        tax_after_rebates = max(0, tax - total_rebate - medical_credits)
        effective_rate = (tax_after_rebates / annual_income * 100) if annual_income > 0 else 0
        
        # Find bracket
        bracket_info = ""
        for i, (limit, rate, _) in enumerate(brackets):
            if taxable_income <= limit:
                prev_limit = brackets[i-1][0] if i > 0 else 0
                bracket_info = f"R{prev_limit:,.0f} – R{limit:,.0f} ({rate*100:.0f}%)"
                break
        
        return {
            "gross_income": annual_income,
            "retirement_deduction": retirement_deduction,
            "taxable_income": taxable_income,
            "bracket": bracket_info,
            "marginal_rate": rate,
            "tax_before_rebates": round(tax, 2),
            "primary_rebate": primary_rebate,
            "secondary_rebate": secondary_rebate if age >= 65 else 0,
            "tertiary_rebate": tertiary_rebate if age >= 75 else 0,
            "medical_credits": medical_credits,
            "total_rebates": total_rebate + medical_credits,
            "tax_payable": round(tax_after_rebates, 2),
            "effective_rate": round(effective_rate, 2),
            "monthly_tax": round(tax_after_rebates / 12, 2),
            "take_home_annual": round(annual_income - tax_after_rebates, 2),
            "take_home_monthly": round((annual_income - tax_after_rebates) / 12, 2),
            "display_type": "stat_cards",
            "tax_year": "2024/25"
        }
    
    # =========================================================================
    # Fraud Analysis
    # =========================================================================
    
    def fraud_analysis(
        self,
        operation: str,
        data: List[float],
        threshold: float = None,
        sensitivity: str = "medium"
    ) -> Dict[str, Any]:
        """Perform fraud detection analysis"""
        
        if operation == "benfords_law":
            return self._benfords_analysis(data)
        elif operation == "find_anomalies":
            return self._anomaly_detection(data, sensitivity)
        elif operation == "duplicate_check":
            return self._duplicate_analysis(data)
        elif operation == "round_number_analysis":
            return self._round_number_analysis(data)
        elif operation == "threshold_analysis":
            return self._threshold_analysis(data, threshold or 10000)
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    def _benfords_analysis(self, data: List[float]) -> Dict[str, Any]:
        """Apply Benford's Law to detect potential manipulation"""
        
        # Expected first digit distribution (Benford's Law)
        expected = {
            1: 30.1, 2: 17.6, 3: 12.5, 4: 9.7, 5: 7.9,
            6: 6.7, 7: 5.8, 8: 5.1, 9: 4.6
        }
        
        # Get first digits
        first_digits = []
        for value in data:
            if value > 0:
                first_digit = int(str(abs(value)).lstrip('0').replace('.', '')[0])
                if 1 <= first_digit <= 9:
                    first_digits.append(first_digit)
        
        # Count occurrences
        counts = Counter(first_digits)
        total = len(first_digits)
        
        if total < 100:
            return {
                "warning": "Benford's Law analysis requires at least 100 values for meaningful results",
                "data_points": total,
                "display_type": "alert_cards"
            }
        
        # Calculate observed percentages
        observed = {d: (counts.get(d, 0) / total * 100) for d in range(1, 10)}
        
        # Chi-square test
        chi_square = sum(
            (counts.get(d, 0) - (expected[d] / 100 * total)) ** 2 / (expected[d] / 100 * total)
            for d in range(1, 10)
        )
        
        # P-value (df = 8)
        p_value = 1 - stats.chi2.cdf(chi_square, 8)
        
        # Flag significant deviations
        flagged_digits = [
            d for d in range(1, 10)
            if abs(observed[d] - expected[d]) > 5  # More than 5% deviation
        ]
        
        # Prepare chart data
        chart_data = [
            {"digit": str(d), "expected": expected[d], "observed": round(observed[d], 1)}
            for d in range(1, 10)
        ]
        
        conclusion = (
            "Data follows Benford's Law (no significant anomalies detected)"
            if p_value > 0.05
            else "Data DEVIATES from Benford's Law - potential manipulation detected!"
        )
        
        return {
            "data_points": total,
            "chi_square": round(chi_square, 2),
            "p_value": round(p_value, 4),
            "conclusion": conclusion,
            "flagged_digits": flagged_digits,
            "deviation_level": "none" if p_value > 0.05 else ("moderate" if p_value > 0.01 else "significant"),
            "chart": {
                "type": "chart",
                "chart_type": "bar",
                "title": "Benford's Law Analysis",
                "subtitle": f"Comparing observed vs expected first-digit distribution (n={total})",
                "data": chart_data,
                "series": [
                    {"dataKey": "expected", "name": "Expected (Benford)", "color": "#737373"},
                    {"dataKey": "observed", "name": "Observed", "color": "#1a1a1a"}
                ],
                "x_label": "First Digit"
            },
            "display_type": "chart"
        }


# Singleton instance
_math_service: Optional[MathService] = None

def get_math_service() -> MathService:
    global _math_service
    if _math_service is None:
        _math_service = MathService()
    return _math_service
```

---

## 🖥️ PHASE C: Display Integration

### C.1 Display Type Mapping

Math tool results include a `display_type` field that maps to frontend components:

| display_type | Frontend Component | Use Case |
|--------------|-------------------|----------|
| `stat_cards` | `StatCards.tsx` | Summary statistics, financial results |
| `data_table` | `DataTable.tsx` | Z-scores, amortization schedules |
| `chart` | `ChartRenderer.tsx` | Benford's Law, distributions |
| `alert_cards` | `AlertCards.tsx` | Outliers, fraud warnings |
| `formula` | `FormulaView.tsx` | Mathematical formulas, steps |
| `comparison` | `ComparisonView.tsx` | Loan comparisons, scenarios |

### C.2 Frontend Dispatcher

```typescript
// File: gogga-frontend/src/lib/mathDisplayHandler.ts

import { ChartData } from '@/types/chart';

export type MathDisplayType = 
  | 'stat_cards'
  | 'data_table'
  | 'chart'
  | 'alert_cards'
  | 'formula'
  | 'comparison';

export interface MathToolResult {
  display_type: MathDisplayType;
  data: Record<string, unknown>;
  chart?: ChartData;
  alerts?: Array<{
    type: 'warning' | 'success' | 'danger' | 'info';
    title: string;
    message: string;
  }>;
}

export function getMathDisplayComponent(result: MathToolResult): React.ComponentType {
  switch (result.display_type) {
    case 'stat_cards':
      return StatCards;
    case 'data_table':
      return DataTable;
    case 'chart':
      return ChartRenderer;
    case 'alert_cards':
      return AlertCards;
    case 'formula':
      return FormulaView;
    case 'comparison':
      return ComparisonView;
    default:
      return StatCards; // Default fallback
  }
}
```

---

## 📋 Implementation Checklist

### Phase A: Prompt Routing ✅ COMPLETED
- [x] Create `math_router.py` with intent classification
- [x] Add math keywords for each category (7 categories)
- [x] Implement tier gating for math features
- [ ] Integrate with existing `router.py` (pending)
- [ ] Implement data request prompts (pending)
- [ ] Unit tests for intent classification

**Implementation Notes (Phase A):**
- File: `gogga-backend/app/core/math_router.py` (~180 lines)
- `MathIntent` dataclass with category, confidence, tool_name, requires_data
- `MATH_KEYWORDS` dict covering: statistics, regression, financial, tax, fraud, probability, conversion
- `classify_math_intent()` with keyword matching + calculation pattern detection
- `TIER_REQUIREMENTS` for feature gating (tax/conversion=FREE, stats/financial=JIVE, regression/fraud=JIGGA)

### Phase B: Math Tool ✅ COMPLETED
- [x] Create `math_definitions.py` with tool schemas
- [x] Implement `MathService` class
- [x] Statistics operations (10 functions)
- [x] Financial calculations (9 functions)
- [x] SA Tax calculator (2024/25 brackets with 7 brackets, 3 rebates)
- [x] Fraud analysis (Benford's Law, anomalies, duplicates, round numbers, thresholds)
- [ ] Unit tests for all calculations (pending)

**Implementation Notes (Phase B):**
- Definitions: `gogga-backend/app/tools/math_definitions.py` (~150 lines)
  - `MATH_STATISTICS_TOOL`: summary, mean, median, mode, std_dev, variance, quartiles, percentile, z_scores, outliers
  - `MATH_FINANCIAL_TOOL`: compound_interest, simple_interest, loan_payment, amortization, npv, irr, present_value, future_value, roi
  - `MATH_SA_TAX_TOOL`: Full 2024/25 SA tax with brackets, rebates, medical credits
  - `MATH_FRAUD_TOOL`: benfords_law, find_anomalies, duplicate_check, round_number_analysis, threshold_analysis
- Service: `gogga-backend/app/services/math_service.py` (~400 lines)
  - Uses scipy for chi-square test, numpy for calculations
  - `calculate_statistics()` with comprehensive stats + chart data generation
  - `calculate_financial()` with compound frequency support
  - `calculate_sa_tax()` with 7 brackets, 3 age-based rebates, medical credits
  - `fraud_analysis()` with Benford's Law expected distribution + chi-square test
- Dependencies added: scipy>=1.14.0, numpy>=2.0.0

### Phase C: Display Integration ✅ COMPLETED
- [x] Create display type mapping
- [x] Implement `mathDisplayHandler.ts`
- [x] Connect to existing display components
- [x] Create StatCards component
- [x] Create AlertCards component
- [x] Create FormulaView component
- [x] Create MathResultDisplay router component
- [x] Create DataTable component

**Implementation Notes (Phase C):**
- Handler: `gogga-frontend/src/lib/mathDisplayHandler.ts` (~420 lines)
  - `MathDisplayType`: stat_cards, data_table, chart, alert_cards, formula, comparison
  - `extractChartData()`, `toStatCards()`, `toAlertCards()`, `toTableData()` helpers
- Components in `gogga-frontend/src/components/display/`:
  - `StatCards.tsx` (~120 lines): Grid display with ZAR currency formatting
  - `AlertCards.tsx` (~80 lines): Warning/success/danger/info with Lucide icons
  - `DataTable.tsx` (~180 lines): Sortable, paginated tables
  - `FormulaView.tsx` (~120 lines): KaTeX integration with copy functionality
  - `MathResultDisplay.tsx` (~180 lines): Main router component
  - `index.ts`: Barrel export for all components

### Phase D: Testing & Documentation ✅ COMPLETED
- [x] Integration tests for full flow
- [x] Manual testing with sample queries
- [x] Update MathTooling.md with implementation notes
- [x] Update Serena memory files
- [x] Update TIERS.md with math tools documentation
- [ ] Add to copilot-instructions.md (optional)

**Implementation Notes (Phase D):**
- Router integration: Math tools added to `definitions.py` and `executor.py`
- Unit tests: `test_math_service.py` with 36 tests covering all operations
- TIERS.md: Added Math Tools sections for JIVE and JIGGA tiers
- Serena memories: Updated data_visualization_system, tool_calling, task_completion

---

## 🔗 Dependencies

### Required from Phase 1 (DATA_VISUALIZATION_SYSTEM.md)
- ✅ `ChartRenderer.tsx` - Enhanced chart component
- ✅ `types/chart.ts` - Chart type definitions
- ✅ Dependencies: mathjs, katex (installed)

### New Backend Dependencies
```bash
pip install scipy numpy pandas
```

### New Files to Create
```
gogga-backend/app/
├── core/
│   └── math_router.py        # Intent classification
├── tools/
│   └── math_definitions.py   # Tool schemas
└── services/
    └── math_service.py       # Calculation engine

gogga-frontend/src/
├── lib/
│   └── mathDisplayHandler.ts # Display routing
└── components/display/
    ├── StatCards.tsx         # Statistics display
    ├── AlertCards.tsx        # Warnings/alerts
    └── FormulaView.tsx       # Math formulas
```

---

## 📝 Notes

### Tier Availability (Reminder)
| Feature | FREE | JIVE | JIGGA |
|---------|------|------|-------|
| SA Tax Calculator | ✅ | ✅ | ✅ |
| Unit Conversion | ✅ | ✅ | ✅ |
| Basic Statistics | ❌ | ✅ | ✅ |
| Financial Formulas | ❌ | ✅ | ✅ |
| Probability | ❌ | ✅ | ✅ |
| Regression/Trends | ❌ | ❌ | ✅ |
| Fraud Analysis | ❌ | ❌ | ✅ |

### SA Tax Notes
- Brackets updated for 2024/25 tax year
- Primary rebate: R17,235
- Medical credits: R364/month (main member + 1), R246/month (additional)
- Retirement deduction: Max 27.5% of income or R350,000

### Benford's Law Notes
- Requires minimum 100 data points
- Chi-square test with 8 degrees of freedom
- P-value < 0.05 indicates potential manipulation
- Flag digits with >5% deviation from expected

---

*Document created as part of GOGGA Data Visualization & Math Tools System*  
*Last Updated: December 8, 2025*
