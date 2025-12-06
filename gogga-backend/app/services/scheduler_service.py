"""
GOGGA Scheduler Service

APScheduler-based cron jobs for:
- Monthly subscription credit resets
- Subscription status management (expired, cancelled)
- Payment failure handling

Runs daily at 00:05 UTC to process all subscriptions due for reset.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings

logger = logging.getLogger(__name__)

# Tier credit/image allocations
TIER_CREDITS = {
    "FREE": 0,
    "JIVE": 500_000,
    "JIGGA": 2_000_000,
}

TIER_IMAGES = {
    "FREE": 0,
    "JIVE": 200,
    "JIGGA": 1000,
}


class SchedulerService:
    """
    Manages scheduled tasks for subscription lifecycle.
    
    Key jobs:
    - daily_subscription_check: Runs at 00:05 UTC daily
      - Resets monthly credits for active subscriptions due for renewal
      - Expires cancelled subscriptions past grace period
      - Marks past_due subscriptions as cancelled after 3 retries
    """
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self._frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"
    
    def start(self) -> None:
        """Start the scheduler with all jobs."""
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        
        # Daily subscription check at 00:05 UTC
        self.scheduler.add_job(
            self.daily_subscription_check,
            CronTrigger(hour=0, minute=5),
            id="daily_subscription_check",
            name="Daily Subscription Check",
            replace_existing=True,
        )
        
        # Credits warning check at 12:00 UTC (optional - for email notifications)
        self.scheduler.add_job(
            self.credits_warning_check,
            CronTrigger(hour=12, minute=0),
            id="credits_warning_check",
            name="Credits Warning Check",
            replace_existing=True,
        )
        
        self.scheduler.start()
        logger.info("Scheduler started with %d jobs", len(self.scheduler.get_jobs()))
        for job in self.scheduler.get_jobs():
            logger.info("  - %s: next run at %s", job.name, job.next_run_time)
    
    def stop(self) -> None:
        """Stop the scheduler gracefully."""
        if self.scheduler:
            self.scheduler.shutdown(wait=True)
            logger.info("Scheduler stopped")
    
    async def daily_subscription_check(self) -> None:
        """
        Daily job to process subscription resets and status changes.
        
        This calls the frontend API which has access to the Prisma database.
        The frontend exposes an internal endpoint for this purpose.
        """
        logger.info("Running daily subscription check...")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Call the frontend internal API to process subscriptions
                response = await client.post(
                    f"{self._frontend_url}/api/internal/subscription-reset",
                    headers={"Authorization": f"Bearer {settings.INTERNAL_API_KEY}"},
                    json={"action": "daily_check"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        "Subscription check complete: %d reset, %d expired, %d cancelled",
                        result.get("reset", 0),
                        result.get("expired", 0),
                        result.get("cancelled", 0),
                    )
                else:
                    logger.error(
                        "Subscription check failed: %d - %s",
                        response.status_code,
                        response.text[:200]
                    )
                    
        except httpx.ConnectError:
            logger.warning("Frontend not reachable for subscription check - will retry tomorrow")
        except Exception as e:
            logger.exception("Subscription check error: %s", e)
    
    async def credits_warning_check(self) -> None:
        """
        Midday job to send low-credits warnings to users.
        
        Identifies users with < 10% credits remaining and sends email.
        """
        logger.info("Running credits warning check...")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self._frontend_url}/api/internal/credits-warning",
                    headers={"Authorization": f"Bearer {settings.INTERNAL_API_KEY}"},
                    json={"threshold_percent": 10}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        "Credits warning check complete: %d warnings sent",
                        result.get("warnings_sent", 0),
                    )
                else:
                    logger.warning(
                        "Credits warning check returned %d: %s",
                        response.status_code,
                        response.text[:200]
                    )
                    
        except httpx.ConnectError:
            logger.debug("Frontend not reachable for credits warning - skipping")
        except Exception as e:
            logger.exception("Credits warning check error: %s", e)
    
    async def trigger_manual_reset(self, user_id: str) -> dict:
        """
        Manually trigger a subscription reset for a specific user.
        Used by admin panel for overrides.
        """
        logger.info("Manual subscription reset for user: %s", user_id)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self._frontend_url}/api/internal/subscription-reset",
                    headers={"Authorization": f"Bearer {settings.INTERNAL_API_KEY}"},
                    json={"action": "manual_reset", "user_id": user_id}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {"error": response.text, "status": response.status_code}
                    
        except Exception as e:
            return {"error": str(e)}


# Singleton instance
scheduler_service = SchedulerService()
