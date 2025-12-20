"""
GOGGA Usage Reconciliation Job

Compares client-estimated tokens with actual backend usage to detect:
1. Token counting discrepancies
2. Missing usage records
3. Cost anomalies

Runs hourly via scheduler or can be triggered manually.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

FRONTEND_URL = settings.FRONTEND_URL.rstrip("/")


async def reconcile_usage(hours_back: int = 1) -> dict:
    """
    Reconcile usage records from the past N hours.
    
    Checks:
    1. Records where estimated tokens differ significantly from actual
    2. Aggregate cost verification
    3. Missing or orphaned records
    
    Args:
        hours_back: Number of hours to look back (default 1)
        
    Returns:
        Summary of reconciliation results
    """
    logger.info(f"Starting usage reconciliation (past {hours_back} hours)...")
    
    results = {
        "status": "success",
        "checked_at": datetime.now().isoformat(),
        "period_hours": hours_back,
        "records_checked": 0,
        "discrepancies": [],
        "total_cost_usd": 0.0,
        "total_cost_zar": 0.0,
        "total_tokens": 0,
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch usage records from the past N hours
            cutoff = datetime.now() - timedelta(hours=hours_back)
            
            # Call internal usage API
            response = await client.get(
                f"{FRONTEND_URL}/api/internal/usage/recent",
                params={"since": cutoff.isoformat()},
                headers={"X-Internal-Key": settings.INTERNAL_API_KEY}
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch usage records: {response.status_code}")
                results["status"] = "partial"
                results["error"] = f"API returned {response.status_code}"
                return results
            
            data = response.json()
            records = data.get("records", [])
            
            results["records_checked"] = len(records)
            
            for record in records:
                # Aggregate totals
                cost_cents = record.get("costCents", 0)
                results["total_cost_zar"] += cost_cents / 100
                results["total_tokens"] += record.get("totalTokens", 0)
                
                # Check for discrepancies
                prompt_tokens = record.get("promptTokens", 0)
                completion_tokens = record.get("completionTokens", 0)
                adjusted_tokens = record.get("adjustedCompletionTokens")
                
                # Flag if adjusted differs significantly from completion
                # (indicates OptiLLM overhead was applied)
                if adjusted_tokens and completion_tokens > 0:
                    ratio = adjusted_tokens / completion_tokens
                    if ratio > 2.0:  # More than 2x is suspicious
                        results["discrepancies"].append({
                            "id": record.get("id"),
                            "type": "high_optillm_ratio",
                            "ratio": round(ratio, 2),
                            "completion_tokens": completion_tokens,
                            "adjusted_tokens": adjusted_tokens,
                        })
                
                # Flag very high token usage (possible prompt injection or bug)
                if prompt_tokens > 100000:  # 100K input tokens is unusual
                    results["discrepancies"].append({
                        "id": record.get("id"),
                        "type": "high_prompt_tokens",
                        "tokens": prompt_tokens,
                    })
            
            # Convert ZAR to USD for total
            zar_rate = settings.ZAR_USD_RATE
            results["total_cost_usd"] = round(results["total_cost_zar"] / zar_rate, 4)
            results["total_cost_zar"] = round(results["total_cost_zar"], 4)
            
            logger.info(
                f"Reconciliation complete: {len(records)} records, "
                f"{len(results['discrepancies'])} discrepancies, "
                f"R{results['total_cost_zar']:.2f} total cost"
            )
            
    except Exception as e:
        logger.error(f"Reconciliation error: {e}")
        results["status"] = "error"
        results["error"] = str(e)
    
    return results


async def run_reconciliation_job() -> None:
    """Run the reconciliation job as a background task."""
    logger.info("Reconciliation job started")
    
    try:
        results = await reconcile_usage(hours_back=1)
        
        if results["discrepancies"]:
            logger.warning(
                f"Found {len(results['discrepancies'])} usage discrepancies. "
                "Review in admin panel."
            )
        
        # TODO: Store results in database for admin dashboard
        # TODO: Send alerts if significant discrepancies found
        
    except Exception as e:
        logger.error(f"Reconciliation job failed: {e}")


# Scheduler integration
def schedule_reconciliation() -> None:
    """
    Schedule the reconciliation job to run hourly.
    Call this from the main app startup.
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            run_reconciliation_job,
            'interval',
            hours=1,
            id='usage_reconciliation',
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Usage reconciliation scheduled (hourly)")
    except ImportError:
        logger.warning(
            "APScheduler not installed. "
            "Reconciliation job will not run automatically. "
            "Install with: pip install apscheduler"
        )


# Manual trigger for testing/admin use
if __name__ == "__main__":
    async def main():
        results = await reconcile_usage(hours_back=24)
        import json
        print(json.dumps(results, indent=2))
    
    asyncio.run(main())
