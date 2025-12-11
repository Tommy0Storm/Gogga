# GOGGA Math Tool Process (GoggaSolve)

## Overview

GoggaSolve is GOGGA's mathematical problem-solving system that provides accurate calculations with visual outputs. This document defines the fixed process the AI must follow for any mathematical problem.

## The Process

### Step 1: Problem Classification

When a user asks a math-related question, classify it into one of these categories:

| Category | Tool | Examples |
|----------|------|----------|
| **Statistics** | `math_statistics` | Mean, median, std dev, outliers, distributions |
| **Financial** | `math_financial` | Compound interest, NPV, IRR, loan amortization |
| **SA Tax** | `math_sa_tax` | PAYE, tax brackets, rebates, deductions |
| **Probability** | `math_probability` | Permutations, combinations, binomial, normal |
| **Conversions** | `math_conversion` | Currency (ZAR/USD), length, weight, temperature |
| **Fraud Analysis** | `math_fraud_analysis` | Benford's Law, anomaly detection (JIGGA only) |

### Step 2: Call Math Tool

**NEVER do math manually.** Always use the appropriate tool:

```
1. Identify the operation type
2. Extract parameters from user's question
3. Call the math_* tool with correct arguments
4. Wait for backend calculation
```

### Step 3: Interpret Results

After receiving the tool result:

1. **Summarize** the key finding in plain language
2. **Explain** what the numbers mean for the user's situation
3. **Highlight** important values (totals, interest earned, etc.)

### Step 4: Visualize (When Appropriate)

**Always call `create_chart` for:**
- Time series data (growth over years, payments over time)
- Comparisons (scenarios, before/after)
- Distributions (pie charts for breakdowns)
- Trends (line charts for projections)

**Chart Selection Guide:**

| Data Type | Chart Type | Example |
|-----------|------------|---------|
| Growth over time | `line` | Savings growth, investment returns |
| Period breakdown | `bar` | Monthly payments, yearly contributions |
| Proportions | `pie` | Budget breakdown, expense categories |
| Correlations | `scatter` | Risk vs return, income vs savings |
| Multi-metric | `composed` | Principal vs interest over time |

### Step 5: Provide Context

After the calculation and chart:

1. **Validate** - Does this make sense for SA context?
2. **Advise** - What should the user consider?
3. **Alternatives** - "Want to see 7% instead of 5%?"

---

## Example: Compound Interest

**User:** "What if I save R1000 per year for 20 years at 5%?"

**Process:**

1. **Classify**: Financial → `math_financial`
2. **Call tool**:
   ```json
   {
     "operation": "future_value",
     "principal": 0,
     "rate": 0.05,
     "periods": 20,
     "payment": 1000
   }
   ```
3. **Interpret**: "After 20 years, you'll have R33,066 - that's R13,066 in pure interest!"
4. **Visualize**: Call `create_chart` with line data showing yearly growth
5. **Context**: "Compound interest really kicks in after year 15. Want to see what 7% would do?"

---

## Two-Pass Architecture

For JIGGA tier, math tools are executed on the backend in a two-pass flow:

```
Pass 1: LLM decides to use math tool
        → Backend executes math_* tool
        → Results fed back to LLM

Pass 2: LLM interprets results
        → Can call create_chart with calculated data
        → Chart tool forwarded to frontend
        → Frontend renders chart
```

This ensures:
- Accurate calculations (Python math, not LLM approximations)
- Proper visualizations (charts based on real data)
- Fast execution (Cerebras 2K tokens/sec)

---

## Tool Definitions

### math_financial

```json
{
  "operation": "future_value" | "present_value" | "npv" | "irr" | "amortization",
  "principal": number,
  "rate": number (decimal, e.g., 0.05 for 5%),
  "periods": number,
  "payment": number (optional, for annuities),
  "cash_flows": number[] (for NPV/IRR)
}
```

### math_statistics

```json
{
  "operation": "descriptive" | "regression" | "outliers",
  "data": number[],
  "x_data": number[] (for regression),
  "y_data": number[] (for regression)
}
```

### math_sa_tax

```json
{
  "gross_income": number,
  "age": number,
  "medical_credits": number (optional),
  "retirement_contributions": number (optional)
}
```

### create_chart

```json
{
  "chart_type": "line" | "bar" | "pie" | "area" | "scatter",
  "title": "Chart Title",
  "data": [
    {"name": "Year 1", "value": 1000},
    {"name": "Year 2", "value": 2050}
  ],
  "x_label": "Year",
  "y_label": "Rands (R)",
  "colors": ["#3366cc", "#ff9900"]
}
```

---

## Tier Availability

| Tool | FREE | JIVE | JIGGA |
|------|------|------|-------|
| math_conversion | ✅ | ✅ | ✅ |
| math_sa_tax | ✅ | ✅ | ✅ |
| math_statistics | ❌ | ✅ | ✅ |
| math_financial | ❌ | ✅ | ✅ |
| math_probability | ❌ | ✅ | ✅ |
| math_fraud_analysis | ❌ | ❌ | ✅ |
| create_chart | ❌ | ✅ | ✅ |

---

## Scalability (2000+ Users)

The system is designed for concurrent users:

1. **Cerebras API**: 2K tokens/second per request
2. **Backend Python**: Async execution, no blocking
3. **Frontend Charts**: Client-side rendering (Recharts)
4. **No State**: Each request is independent

Rate limits:
- Cerebras: Retry with backoff (1s, 2s, 4s)
- Fallback: OpenRouter if Cerebras is busy
- Charts: No limit (client-side)
