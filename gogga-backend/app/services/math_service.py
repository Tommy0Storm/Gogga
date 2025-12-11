"""
GOGGA Math Service

Core calculation engine for statistics, financial formulas, 
SA tax calculations, and fraud analysis.
"""

import math
import logging
from typing import Any, Optional
from collections import Counter
from dataclasses import dataclass
import numpy as np
from scipy import stats

# Configure verbose logging for math operations
logger = logging.getLogger("gogga.math")
logger.setLevel(logging.DEBUG)


@dataclass
class MathResult:
    """Standard result format for math operations"""
    success: bool
    data: dict[str, Any]
    display_type: str  # stat_cards, data_table, chart, alert_cards, formula
    error: Optional[str] = None


class MathService:
    """
    Core math service for GOGGA.
    Handles statistics, financial calculations, tax, and fraud analysis.
    """
    
    # =========================================================================
    # Statistics Operations
    # =========================================================================
    
    def calculate_statistics(
        self, 
        operation: str, 
        data: list[float],
        percentile_value: float = 50
    ) -> MathResult:
        """
        Perform statistical calculations.
        
        Args:
            operation: The statistical operation to perform
            data: Array of numbers to analyse
            percentile_value: Percentile to calculate (0-100)
            
        Returns:
            MathResult with calculation results
        """
        logger.info(f"📊 MATH STATS: operation={operation}, data_count={len(data) if data else 0}")
        logger.debug(f"📊 MATH STATS: data={data[:10]}{'...' if len(data) > 10 else ''}")
        
        if not data:
            logger.error("📊 MATH STATS: Empty data array")
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error="Data array cannot be empty"
            )
        
        try:
            if operation == "summary":
                result = self._summary_stats(data)
            elif operation == "mean":
                result = {"mean": float(np.mean(data)), "count": len(data)}
            elif operation == "median":
                result = {"median": float(np.median(data)), "count": len(data)}
            elif operation == "mode":
                mode_result = stats.mode(data, keepdims=True)
                result = {
                    "mode": float(mode_result.mode[0]), 
                    "frequency": int(mode_result.count[0])
                }
            elif operation == "std_dev":
                result = {
                    "std_dev": float(np.std(data, ddof=1)), 
                    "variance": float(np.var(data, ddof=1))
                }
            elif operation == "variance":
                result = {"variance": float(np.var(data, ddof=1))}
            elif operation == "range":
                result = {
                    "min": float(min(data)), 
                    "max": float(max(data)), 
                    "range": float(max(data) - min(data))
                }
            elif operation == "quartiles":
                result = self._quartiles(data)
            elif operation == "percentile":
                result = {
                    "percentile": percentile_value, 
                    "value": float(np.percentile(data, percentile_value))
                }
            elif operation == "z_scores":
                result = self._z_scores(data)
            elif operation == "outliers":
                result = self._find_outliers(data)
            else:
                logger.error(f"📊 MATH STATS: Unknown operation: {operation}")
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Unknown operation: {operation}"
                )
            
            display_type = result.pop("display_type", "stat_cards")
            logger.info(f"📊 MATH STATS SUCCESS: display_type={display_type}, result_keys={list(result.keys())}")
            return MathResult(success=True, data=result, display_type=display_type)
            
        except Exception as e:
            logger.exception(f"📊 MATH STATS ERROR: {e}")
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    def _summary_stats(self, data: list[float]) -> dict[str, Any]:
        """Generate comprehensive summary statistics."""
        q1, q2, q3 = np.percentile(data, [25, 50, 75])
        return {
            "count": len(data),
            "mean": round(float(np.mean(data)), 4),
            "median": round(float(np.median(data)), 4),
            "mode": round(float(stats.mode(data, keepdims=True).mode[0]), 4),
            "std_dev": round(float(np.std(data, ddof=1)), 4),
            "variance": round(float(np.var(data, ddof=1)), 4),
            "min": round(float(min(data)), 4),
            "max": round(float(max(data)), 4),
            "range": round(float(max(data) - min(data)), 4),
            "q1": round(float(q1), 4),
            "q2": round(float(q2), 4),
            "q3": round(float(q3), 4),
            "iqr": round(float(q3 - q1), 4),
            "skewness": round(float(stats.skew(data)), 4),
            "kurtosis": round(float(stats.kurtosis(data)), 4),
            "display_type": "stat_cards"
        }
    
    def _quartiles(self, data: list[float]) -> dict[str, Any]:
        """Calculate quartiles and IQR."""
        q1, q2, q3 = np.percentile(data, [25, 50, 75])
        return {
            "q1": round(float(q1), 4),
            "q2_median": round(float(q2), 4),
            "q3": round(float(q3), 4),
            "iqr": round(float(q3 - q1), 4),
            "min": round(float(min(data)), 4),
            "max": round(float(max(data)), 4),
            "display_type": "stat_cards"
        }
    
    def _z_scores(self, data: list[float]) -> dict[str, Any]:
        """Calculate Z-scores for each data point."""
        mean = np.mean(data)
        std = np.std(data, ddof=1)
        z_scores = [round((x - mean) / std, 4) for x in data]
        return {
            "z_scores": z_scores,
            "mean": round(float(mean), 4),
            "std_dev": round(float(std), 4),
            "display_type": "data_table"
        }
    
    def _find_outliers(self, data: list[float]) -> dict[str, Any]:
        """Find outliers using IQR method."""
        q1, q3 = np.percentile(data, [25, 75])
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = [x for x in data if x < lower_bound or x > upper_bound]
        
        return {
            "outliers": outliers,
            "outlier_count": len(outliers),
            "lower_bound": round(float(lower_bound), 4),
            "upper_bound": round(float(upper_bound), 4),
            "q1": round(float(q1), 4),
            "q3": round(float(q3), 4),
            "iqr": round(float(iqr), 4),
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
        cash_flows: Optional[list[float]] = None,
        compound_frequency: str = "monthly"
    ) -> MathResult:
        """
        Perform financial calculations.
        
        Args:
            operation: The financial calculation to perform
            principal: Initial amount in ZAR
            rate: Annual interest rate as decimal (0.12 = 12%)
            periods: Number of years
            payment: Regular payment amount
            cash_flows: Cash flows for NPV/IRR
            compound_frequency: How often interest compounds
            
        Returns:
            MathResult with calculation results
        """
        freq_map = {
            "annually": 1, 
            "semi-annually": 2, 
            "quarterly": 4,
            "monthly": 12, 
            "daily": 365
        }
        n = freq_map.get(compound_frequency, 12)
        
        try:
            if operation == "compound_interest":
                result = self._compound_interest(principal, rate, periods, n)
            elif operation == "simple_interest":
                result = self._simple_interest(principal, rate, periods)
            elif operation == "loan_payment":
                result = self._pmt(principal, rate, periods, n)
            elif operation == "amortization":
                result = self._amortization_schedule(principal, rate, periods, n)
            elif operation == "npv":
                result = self._npv(rate, cash_flows or [])
            elif operation == "irr":
                result = self._irr(cash_flows or [])
            elif operation == "present_value":
                result = self._present_value(payment, rate, periods, n)
            elif operation == "future_value":
                result = self._future_value(principal, rate, periods, n)
            elif operation == "roi":
                result = self._roi(principal, payment)
            else:
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Unknown operation: {operation}"
                )
            
            display_type = result.pop("display_type", "stat_cards")
            return MathResult(success=True, data=result, display_type=display_type)
            
        except Exception as e:
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    def _compound_interest(
        self, p: float, r: float, t: int, n: int
    ) -> dict[str, Any]:
        """A = P(1 + r/n)^(nt)"""
        amount = p * (1 + r/n) ** (n * t)
        interest = amount - p
        effective_rate = (1 + r/n) ** n - 1
        return {
            "principal": p,
            "annual_rate": f"{r*100:.2f}%",
            "periods_years": t,
            "compound_frequency": n,
            "final_amount": round(amount, 2),
            "total_interest": round(interest, 2),
            "effective_annual_rate": f"{effective_rate*100:.2f}%",
            "formula": f"A = R{p:,.2f} × (1 + {r:.4f}/{n})^({n} × {t})",
            "display_type": "stat_cards"
        }
    
    def _simple_interest(self, p: float, r: float, t: int) -> dict[str, Any]:
        """I = PRT"""
        interest = p * r * t
        amount = p + interest
        return {
            "principal": p,
            "annual_rate": f"{r*100:.2f}%",
            "periods_years": t,
            "interest": round(interest, 2),
            "final_amount": round(amount, 2),
            "formula": f"I = R{p:,.2f} × {r:.4f} × {t}",
            "display_type": "stat_cards"
        }
    
    def _pmt(self, pv: float, r: float, years: int, freq: int) -> dict[str, Any]:
        """Calculate loan payment: PMT = PV × [r(1+r)^n] / [(1+r)^n - 1]"""
        r_per = r / freq
        n_total = years * freq
        
        if r_per == 0:
            pmt = pv / n_total
        else:
            pmt = pv * (r_per * (1 + r_per) ** n_total) / ((1 + r_per) ** n_total - 1)
        
        total_paid = pmt * n_total
        total_interest = total_paid - pv
        
        return {
            "loan_amount": f"R{pv:,.2f}",
            "annual_rate": f"{r*100:.2f}%",
            "term_years": years,
            "payments_per_year": freq,
            "monthly_payment": f"R{pmt:,.2f}",
            "total_paid": f"R{total_paid:,.2f}",
            "total_interest": f"R{total_interest:,.2f}",
            "formula": f"PMT = R{pv:,.2f} at {r*100:.1f}% over {years} years",
            "display_type": "stat_cards"
        }
    
    def _amortization_schedule(
        self, pv: float, r: float, years: int, freq: int
    ) -> dict[str, Any]:
        """Generate amortization schedule."""
        r_per = r / freq
        n_total = years * freq
        
        if r_per == 0:
            pmt = pv / n_total
        else:
            pmt = pv * (r_per * (1 + r_per) ** n_total) / ((1 + r_per) ** n_total - 1)
        
        schedule = []
        balance = pv
        total_interest = 0
        
        for period in range(1, min(n_total + 1, 61)):  # Max 60 periods in output
            interest_payment = balance * r_per
            principal_payment = pmt - interest_payment
            balance -= principal_payment
            total_interest += interest_payment
            
            schedule.append({
                "period": period,
                "payment": round(pmt, 2),
                "principal": round(principal_payment, 2),
                "interest": round(interest_payment, 2),
                "balance": round(max(0, balance), 2)
            })
        
        return {
            "monthly_payment": f"R{pmt:,.2f}",
            "total_interest": f"R{total_interest:,.2f}",
            "schedule": schedule,
            "periods_shown": len(schedule),
            "total_periods": n_total,
            "display_type": "data_table"
        }
    
    def _npv(self, rate: float, cash_flows: list[float]) -> dict[str, Any]:
        """Calculate Net Present Value."""
        if not cash_flows:
            raise ValueError("Cash flows required for NPV calculation")
        
        npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
        
        return {
            "npv": round(npv, 2),
            "discount_rate": f"{rate*100:.2f}%",
            "num_periods": len(cash_flows),
            "initial_investment": f"R{abs(cash_flows[0]):,.2f}",
            "decision": "Accept (NPV > 0)" if npv > 0 else "Reject (NPV ≤ 0)",
            "display_type": "stat_cards"
        }
    
    def _irr(self, cash_flows: list[float]) -> dict[str, Any]:
        """Calculate Internal Rate of Return using numpy."""
        if not cash_flows:
            raise ValueError("Cash flows required for IRR calculation")
        
        # Use numpy's IRR function
        try:
            irr = float(np.irr(cash_flows))
        except (ValueError, RuntimeWarning):
            # Fallback: use Newton-Raphson approximation
            irr = self._irr_newton(cash_flows)
        
        return {
            "irr": f"{irr*100:.2f}%",
            "num_periods": len(cash_flows),
            "initial_investment": f"R{abs(cash_flows[0]):,.2f}",
            "display_type": "stat_cards"
        }
    
    def _irr_newton(self, cash_flows: list[float], tol: float = 1e-6) -> float:
        """Newton-Raphson IRR calculation."""
        rate = 0.1  # Initial guess
        for _ in range(100):
            npv = sum(cf / (1 + rate) ** i for i, cf in enumerate(cash_flows))
            d_npv = sum(-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows))
            if abs(d_npv) < tol:
                break
            rate -= npv / d_npv
        return rate
    
    def _present_value(
        self, pmt: float, r: float, years: int, freq: int
    ) -> dict[str, Any]:
        """Calculate present value of annuity."""
        r_per = r / freq
        n_total = years * freq
        
        if r_per == 0:
            pv = pmt * n_total
        else:
            pv = pmt * (1 - (1 + r_per) ** -n_total) / r_per
        
        return {
            "present_value": f"R{pv:,.2f}",
            "payment": f"R{pmt:,.2f}",
            "annual_rate": f"{r*100:.2f}%",
            "periods_years": years,
            "display_type": "stat_cards"
        }
    
    def _future_value(
        self, p: float, r: float, years: int, freq: int
    ) -> dict[str, Any]:
        """Calculate future value."""
        amount = p * (1 + r/freq) ** (freq * years)
        return {
            "future_value": f"R{amount:,.2f}",
            "principal": f"R{p:,.2f}",
            "annual_rate": f"{r*100:.2f}%",
            "periods_years": years,
            "total_growth": f"R{amount - p:,.2f}",
            "display_type": "stat_cards"
        }
    
    def _roi(self, initial: float, final: float) -> dict[str, Any]:
        """Calculate Return on Investment."""
        roi = (final - initial) / initial
        return {
            "roi": f"{roi*100:.2f}%",
            "initial_investment": f"R{initial:,.2f}",
            "final_value": f"R{final:,.2f}",
            "gain_loss": f"R{final - initial:,.2f}",
            "display_type": "stat_cards"
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
    ) -> MathResult:
        """
        Calculate SA income tax for 2024/25 tax year.
        
        Args:
            annual_income: Total annual taxable income in ZAR
            age: Taxpayer's age (affects rebates)
            medical_scheme_members: Number of dependants on medical scheme
            retirement_contributions: Annual retirement fund contributions
            
        Returns:
            MathResult with tax calculation breakdown
        """
        logger.info(f"🧾 SA TAX CALC: income=R{annual_income:,.2f}, age={age}, medical_members={medical_scheme_members}, retirement=R{retirement_contributions:,.2f}")
        
        try:
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
            
            # Apply retirement deduction (max 27.5% of income, max R350k)
            retirement_deduction = min(
                retirement_contributions, 
                min(annual_income * 0.275, 350000)
            )
            taxable_income = max(0, annual_income - retirement_deduction)
            logger.debug(f"🧾 SA TAX: retirement_deduction=R{retirement_deduction:,.2f}, taxable_income=R{taxable_income:,.2f}")
            
            # Check threshold
            if age < 65 and taxable_income <= threshold_under_65:
                logger.info(f"🧾 SA TAX: Below threshold (under 65), no tax payable")
                return MathResult(
                    success=True,
                    data={
                        "tax_payable": "R0.00",
                        "reason": "Below tax threshold",
                        "threshold": f"R{threshold_under_65:,.0f}"
                    },
                    display_type="stat_cards"
                )
            elif 65 <= age < 75 and taxable_income <= threshold_65_to_74:
                logger.info(f"🧾 SA TAX: Below threshold (65-74), no tax payable")
                return MathResult(
                    success=True,
                    data={
                        "tax_payable": "R0.00",
                        "reason": "Below tax threshold for age 65-74",
                        "threshold": f"R{threshold_65_to_74:,.0f}"
                    },
                    display_type="stat_cards"
                )
            elif age >= 75 and taxable_income <= threshold_75_plus:
                logger.info(f"🧾 SA TAX: Below threshold (75+), no tax payable")
                return MathResult(
                    success=True,
                    data={
                        "tax_payable": "R0.00",
                        "reason": "Below tax threshold for age 75+",
                        "threshold": f"R{threshold_75_plus:,.0f}"
                    },
                    display_type="stat_cards"
                )
            
            # Calculate tax
            tax = 0.0
            marginal_rate = 0.18
            bracket_info = ""
            
            for i, (limit, rate, base) in enumerate(brackets):
                if taxable_income <= limit:
                    if i == 0:
                        tax = taxable_income * rate
                    else:
                        prev_limit = brackets[i-1][0]
                        tax = base + (taxable_income - prev_limit) * rate
                    marginal_rate = rate
                    prev_limit_display = brackets[i-1][0] if i > 0 else 0
                    bracket_info = f"R{prev_limit_display:,.0f} – R{limit:,.0f} ({rate*100:.0f}%)"
                    break
            
            logger.debug(f"🧾 SA TAX: bracket={bracket_info}, marginal_rate={marginal_rate*100:.0f}%, tax_before_rebates=R{tax:,.2f}")
            
            # Apply rebates
            total_rebate = primary_rebate
            if age >= 65:
                total_rebate += secondary_rebate
            if age >= 75:
                total_rebate += tertiary_rebate
            
            # Medical credits (R364/month for first 2, R246 for each additional)
            if medical_scheme_members >= 1:
                main_members = min(medical_scheme_members, 2)
                additional = max(0, medical_scheme_members - 2)
                medical_credits = (main_members * 364 + additional * 246) * 12
            else:
                medical_credits = 0
            
            tax_after_rebates = max(0, tax - total_rebate - medical_credits)
            effective_rate = (tax_after_rebates / annual_income * 100) if annual_income > 0 else 0
            
            logger.info(f"🧾 SA TAX SUCCESS: tax_payable=R{tax_after_rebates:,.2f}, effective_rate={effective_rate:.2f}%, monthly=R{tax_after_rebates/12:,.2f}")
            
            result = {
                "gross_income": f"R{annual_income:,.2f}",
                "retirement_deduction": f"R{retirement_deduction:,.2f}",
                "taxable_income": f"R{taxable_income:,.2f}",
                "tax_bracket": bracket_info,
                "marginal_rate": f"{marginal_rate*100:.0f}%",
                "tax_before_rebates": f"R{tax:,.2f}",
                "primary_rebate": f"R{primary_rebate:,.2f}",
                "secondary_rebate": f"R{secondary_rebate:,.2f}" if age >= 65 else "N/A",
                "tertiary_rebate": f"R{tertiary_rebate:,.2f}" if age >= 75 else "N/A",
                "medical_credits": f"R{medical_credits:,.2f}",
                "total_rebates": f"R{total_rebate + medical_credits:,.2f}",
                "tax_payable": f"R{tax_after_rebates:,.2f}",
                "effective_rate": f"{effective_rate:.2f}%",
                "monthly_tax": f"R{tax_after_rebates / 12:,.2f}",
                "take_home_annual": f"R{annual_income - tax_after_rebates:,.2f}",
                "take_home_monthly": f"R{(annual_income - tax_after_rebates) / 12:,.2f}",
                "tax_year": "2024/25"
            }
            
            return MathResult(success=True, data=result, display_type="stat_cards")
            
        except Exception as e:
            logger.exception(f"🧾 SA TAX ERROR: {e}")
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    # =========================================================================
    # Fraud Analysis
    # =========================================================================
    
    def fraud_analysis(
        self,
        operation: str,
        data: list[float],
        threshold: Optional[float] = None,
        sensitivity: str = "medium"
    ) -> MathResult:
        """
        Perform fraud detection analysis.
        
        Args:
            operation: The fraud analysis operation
            data: Financial values to analyse
            threshold: Threshold value for analysis (e.g., approval limit)
            sensitivity: Sensitivity level for anomaly detection
            
        Returns:
            MathResult with analysis results
        """
        if not data:
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error="Data array cannot be empty"
            )
        
        try:
            if operation == "benfords_law":
                result = self._benfords_analysis(data)
            elif operation == "find_anomalies":
                result = self._anomaly_detection(data, sensitivity)
            elif operation == "duplicate_check":
                result = self._duplicate_analysis(data)
            elif operation == "round_number_analysis":
                result = self._round_number_analysis(data)
            elif operation == "threshold_analysis":
                result = self._threshold_analysis(data, threshold or 10000)
            else:
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Unknown operation: {operation}"
                )
            
            display_type = result.pop("display_type", "stat_cards")
            return MathResult(success=True, data=result, display_type=display_type)
            
        except Exception as e:
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    def _benfords_analysis(self, data: list[float]) -> dict[str, Any]:
        """Apply Benford's Law to detect potential manipulation."""
        # Expected first digit distribution (Benford's Law)
        expected = {
            1: 30.1, 2: 17.6, 3: 12.5, 4: 9.7, 5: 7.9,
            6: 6.7, 7: 5.8, 8: 5.1, 9: 4.6
        }
        
        # Get first digits
        first_digits = []
        for value in data:
            if value > 0:
                str_val = str(abs(value)).lstrip('0').replace('.', '')
                if str_val:
                    first_digit = int(str_val[0])
                    if 1 <= first_digit <= 9:
                        first_digits.append(first_digit)
        
        # Count occurrences
        counts = Counter(first_digits)
        total = len(first_digits)
        
        if total < 100:
            return {
                "warning": "Benford's Law requires at least 100 values for meaningful results",
                "data_points": total,
                "recommendation": "Collect more data for reliable fraud detection",
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
            {
                "name": str(d), 
                "expected": expected[d], 
                "observed": round(observed[d], 1)
            }
            for d in range(1, 10)
        ]
        
        if p_value > 0.05:
            conclusion = "Data follows Benford's Law - no significant anomalies detected"
            deviation_level = "none"
        elif p_value > 0.01:
            conclusion = "Data shows MODERATE deviation from Benford's Law - review recommended"
            deviation_level = "moderate"
        else:
            conclusion = "Data SIGNIFICANTLY deviates from Benford's Law - potential manipulation!"
            deviation_level = "significant"
        
        return {
            "data_points": total,
            "chi_square": round(chi_square, 2),
            "p_value": round(p_value, 4),
            "conclusion": conclusion,
            "flagged_digits": flagged_digits,
            "deviation_level": deviation_level,
            "chart": {
                "type": "chart",
                "chart_type": "bar",
                "title": "Benford's Law Analysis",
                "subtitle": f"Comparing observed vs expected first-digit distribution (n={total})",
                "data": chart_data,
                "series": [
                    {"dataKey": "expected", "name": "Expected (Benford)", "color": "#737373"},
                    {"dataKey": "observed", "name": "Observed", "color": "#1a1a1a"}
                ]
            },
            "display_type": "chart"
        }
    
    def _anomaly_detection(
        self, data: list[float], sensitivity: str
    ) -> dict[str, Any]:
        """Statistical anomaly detection using Z-scores."""
        sensitivity_thresholds = {"low": 3.0, "medium": 2.5, "high": 2.0}
        z_threshold = sensitivity_thresholds.get(sensitivity, 2.5)
        
        mean = np.mean(data)
        std = np.std(data, ddof=1)
        
        anomalies = []
        for i, value in enumerate(data):
            z_score = (value - mean) / std if std > 0 else 0
            if abs(z_score) > z_threshold:
                anomalies.append({
                    "index": i,
                    "value": value,
                    "z_score": round(z_score, 2)
                })
        
        return {
            "total_values": len(data),
            "anomaly_count": len(anomalies),
            "sensitivity": sensitivity,
            "z_threshold": z_threshold,
            "mean": round(float(mean), 2),
            "std_dev": round(float(std), 2),
            "anomalies": anomalies[:20],  # Limit to first 20
            "display_type": "alert_cards" if anomalies else "stat_cards"
        }
    
    def _duplicate_analysis(self, data: list[float]) -> dict[str, Any]:
        """Find duplicate values in the data."""
        counts = Counter(data)
        duplicates = {k: v for k, v in counts.items() if v > 1}
        
        # Sort by frequency
        sorted_dupes = sorted(duplicates.items(), key=lambda x: x[1], reverse=True)
        
        return {
            "total_values": len(data),
            "unique_values": len(counts),
            "duplicate_count": len(duplicates),
            "duplicate_percentage": round(len(duplicates) / len(counts) * 100, 2) if counts else 0,
            "top_duplicates": [
                {"value": v, "count": c} for v, c in sorted_dupes[:10]
            ],
            "display_type": "alert_cards" if duplicates else "stat_cards"
        }
    
    def _round_number_analysis(self, data: list[float]) -> dict[str, Any]:
        """Analyse distribution of round numbers (potential manipulation indicator)."""
        round_counts = {
            "ending_00": 0,
            "ending_000": 0,
            "ending_50": 0,
            "whole_numbers": 0,
        }
        
        for value in data:
            if value == int(value):
                round_counts["whole_numbers"] += 1
            if str(value).endswith('00') or str(value).endswith('00.0'):
                round_counts["ending_00"] += 1
            if str(value).endswith('000') or str(value).endswith('000.0'):
                round_counts["ending_000"] += 1
            if str(value).endswith('50') or str(value).endswith('50.0'):
                round_counts["ending_50"] += 1
        
        total = len(data)
        percentages = {k: round(v / total * 100, 2) for k, v in round_counts.items()}
        
        # Flag if round numbers are significantly over-represented
        is_suspicious = percentages["ending_00"] > 15 or percentages["ending_000"] > 5
        
        return {
            "total_values": total,
            "round_number_counts": round_counts,
            "percentages": percentages,
            "suspicious": is_suspicious,
            "conclusion": (
                "High proportion of round numbers detected - may indicate estimation or manipulation"
                if is_suspicious else
                "Round number distribution appears normal"
            ),
            "display_type": "alert_cards" if is_suspicious else "stat_cards"
        }
    
    def _threshold_analysis(
        self, data: list[float], threshold: float
    ) -> dict[str, Any]:
        """Analyse values clustering just below a threshold (approval splitting)."""
        # Define "just below" as within 5% of threshold
        margin = threshold * 0.05
        lower_bound = threshold - margin
        
        below_threshold = [v for v in data if lower_bound <= v < threshold]
        above_threshold = [v for v in data if v >= threshold]
        
        below_percentage = len(below_threshold) / len(data) * 100 if data else 0
        
        # Expected: if uniform distribution, about 5% should be in this range
        is_suspicious = below_percentage > 15  # More than 3x expected
        
        return {
            "total_values": len(data),
            "threshold": threshold,
            "check_range": f"R{lower_bound:,.2f} - R{threshold:,.2f}",
            "values_just_below": len(below_threshold),
            "values_above": len(above_threshold),
            "percentage_just_below": round(below_percentage, 2),
            "suspicious": is_suspicious,
            "conclusion": (
                f"Unusually high concentration of values just below R{threshold:,.0f} threshold - "
                "may indicate approval splitting"
                if is_suspicious else
                "No unusual clustering below threshold detected"
            ),
            "examples": sorted(below_threshold, reverse=True)[:10] if below_threshold else [],
            "display_type": "alert_cards" if is_suspicious else "stat_cards"
        }
    
    # =========================================================================
    # Probability Calculations
    # =========================================================================
    
    def calculate_probability(
        self,
        operation: str,
        n: Optional[int] = None,
        r: Optional[int] = None,
        p: Optional[float] = None,
        mean: Optional[float] = None,
        std_dev: Optional[float] = None,
        x: Optional[float] = None,
        values: Optional[list[float]] = None,
        probabilities: Optional[list[float]] = None
    ) -> MathResult:
        """
        Calculate probabilities and combinatorics.
        
        Args:
            operation: The probability calculation to perform
            n: Total number of trials or items
            r: Number of successes or selections
            p: Probability of success (0 to 1)
            mean: Mean for normal distribution
            std_dev: Standard deviation for normal distribution
            x: Value to find probability for
            values: Values for expected value calculation
            probabilities: Probabilities corresponding to values
            
        Returns:
            MathResult with calculation results
        """
        try:
            if operation == "binomial":
                if n is None or r is None or p is None:
                    raise ValueError("Binomial requires n, r, and p")
                prob = stats.binom.pmf(r, n, p)
                result = {
                    "probability": round(prob, 6),
                    "percentage": f"{prob*100:.4f}%",
                    "n_trials": n,
                    "k_successes": r,
                    "p_success": p,
                    "formula": f"P(X = {r}) = C({n},{r}) × {p}^{r} × {1-p}^{n-r}"
                }
            
            elif operation == "normal_probability":
                if mean is None or std_dev is None or x is None:
                    raise ValueError("Normal distribution requires mean, std_dev, and x")
                prob_less = stats.norm.cdf(x, mean, std_dev)
                result = {
                    "p_less_than": round(prob_less, 6),
                    "p_greater_than": round(1 - prob_less, 6),
                    "z_score": round((x - mean) / std_dev, 4),
                    "x_value": x,
                    "mean": mean,
                    "std_dev": std_dev
                }
            
            elif operation == "permutation":
                if n is None or r is None:
                    raise ValueError("Permutation requires n and r")
                perm = math.perm(n, r)
                result = {
                    "permutation": perm,
                    "formula": f"P({n},{r}) = {n}! / ({n}-{r})!",
                    "n": n,
                    "r": r
                }
            
            elif operation == "combination":
                if n is None or r is None:
                    raise ValueError("Combination requires n and r")
                comb = math.comb(n, r)
                result = {
                    "combination": comb,
                    "formula": f"C({n},{r}) = {n}! / ({r}! × ({n}-{r})!)",
                    "n": n,
                    "r": r
                }
            
            elif operation == "factorial":
                if n is None:
                    raise ValueError("Factorial requires n")
                fact = math.factorial(n)
                result = {
                    "factorial": fact,
                    "formula": f"{n}!",
                    "n": n
                }
            
            elif operation == "expected_value":
                if values is None or probabilities is None:
                    raise ValueError("Expected value requires values and probabilities")
                if len(values) != len(probabilities):
                    raise ValueError("Values and probabilities must have same length")
                if abs(sum(probabilities) - 1.0) > 0.01:
                    raise ValueError("Probabilities must sum to 1")
                ev = sum(v * p for v, p in zip(values, probabilities))
                result = {
                    "expected_value": round(ev, 4),
                    "values": values,
                    "probabilities": probabilities
                }
            
            elif operation == "odds":
                if p is None:
                    raise ValueError("Odds conversion requires probability p")
                odds_for = p / (1 - p) if p < 1 else float('inf')
                odds_against = (1 - p) / p if p > 0 else float('inf')
                result = {
                    "probability": p,
                    "odds_for": f"{odds_for:.2f}:1" if odds_for != float('inf') else "∞:1",
                    "odds_against": f"{odds_against:.2f}:1" if odds_against != float('inf') else "∞:1",
                    "percentage": f"{p*100:.2f}%"
                }
            
            else:
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Unknown operation: {operation}"
                )
            
            return MathResult(success=True, data=result, display_type="stat_cards")
            
        except Exception as e:
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    # =========================================================================
    # Unit Conversion
    # =========================================================================
    
    def convert_units(
        self,
        value: float,
        from_unit: str,
        to_unit: str
    ) -> MathResult:
        """
        Convert between units of measurement.
        
        Args:
            value: The value to convert
            from_unit: The unit to convert from
            to_unit: The unit to convert to
            
        Returns:
            MathResult with conversion result
        """
        # Conversion factors to base units
        conversions = {
            # Temperature (special handling)
            "celsius": ("temp", 1),
            "fahrenheit": ("temp", 1),
            "kelvin": ("temp", 1),
            
            # Distance (base: meters)
            "km": ("distance", 1000),
            "miles": ("distance", 1609.34),
            "meters": ("distance", 1),
            "feet": ("distance", 0.3048),
            "inches": ("distance", 0.0254),
            "cm": ("distance", 0.01),
            
            # Weight (base: kg)
            "kg": ("weight", 1),
            "pounds": ("weight", 0.453592),
            "grams": ("weight", 0.001),
            "ounces": ("weight", 0.0283495),
            
            # Volume (base: liters)
            "liters": ("volume", 1),
            "gallons": ("volume", 3.78541),
            "ml": ("volume", 0.001),
            
            # Currency (approximate rates - should use API for live rates)
            "zar": ("currency", 1),
            "usd": ("currency", 18.5),  # Approximate ZAR per USD
            "eur": ("currency", 20.0),  # Approximate ZAR per EUR
            "gbp": ("currency", 23.5),  # Approximate ZAR per GBP
        }
        
        try:
            from_info = conversions.get(from_unit)
            to_info = conversions.get(to_unit)
            
            if not from_info or not to_info:
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Unknown unit: {from_unit if not from_info else to_unit}"
                )
            
            if from_info[0] != to_info[0]:
                return MathResult(
                    success=False,
                    data={},
                    display_type="alert_cards",
                    error=f"Cannot convert {from_info[0]} to {to_info[0]}"
                )
            
            # Temperature special handling
            if from_info[0] == "temp":
                result_value = self._convert_temperature(value, from_unit, to_unit)
            else:
                # Convert to base unit, then to target
                base_value = value * from_info[1]
                result_value = base_value / to_info[1]
            
            # Format based on magnitude
            if abs(result_value) < 0.01:
                formatted = f"{result_value:.6f}"
            elif abs(result_value) < 1:
                formatted = f"{result_value:.4f}"
            else:
                formatted = f"{result_value:,.2f}"
            
            # Add unit symbol/prefix for currencies
            if from_info[0] == "currency":
                currency_symbols = {"zar": "R", "usd": "$", "eur": "€", "gbp": "£"}
                from_symbol = currency_symbols.get(from_unit, "")
                to_symbol = currency_symbols.get(to_unit, "")
                from_display = f"{from_symbol}{value:,.2f}"
                to_display = f"{to_symbol}{result_value:,.2f}"
            else:
                from_display = f"{value} {from_unit}"
                to_display = f"{formatted} {to_unit}"
            
            return MathResult(
                success=True,
                data={
                    "original": from_display,
                    "converted": to_display,
                    "value": result_value,
                    "from_unit": from_unit,
                    "to_unit": to_unit,
                    "note": "Currency rates are approximate" if from_info[0] == "currency" else None
                },
                display_type="stat_cards"
            )
            
        except Exception as e:
            return MathResult(
                success=False,
                data={},
                display_type="alert_cards",
                error=str(e)
            )
    
    def _convert_temperature(
        self, value: float, from_unit: str, to_unit: str
    ) -> float:
        """Convert between temperature units."""
        # First convert to Celsius
        if from_unit == "fahrenheit":
            celsius = (value - 32) * 5/9
        elif from_unit == "kelvin":
            celsius = value - 273.15
        else:
            celsius = value
        
        # Then convert to target
        if to_unit == "fahrenheit":
            return celsius * 9/5 + 32
        elif to_unit == "kelvin":
            return celsius + 273.15
        else:
            return celsius


# =============================================================================
# Singleton Instance
# =============================================================================

_math_service: Optional[MathService] = None


def get_math_service() -> MathService:
    """Get or create the singleton MathService instance."""
    global _math_service
    if _math_service is None:
        _math_service = MathService()
    return _math_service
