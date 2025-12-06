"""
GOGGA Main Application
FastAPI application entry point with middleware configuration.
"""
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.endpoints import chat, payments, images, prompts
from app.services.posthog_service import posthog_service
from app.services.scheduler_service import scheduler_service
from app.core.exceptions import (
    GoggaException,
    gogga_exception_handler,
    general_exception_handler
)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.
    Handles startup and shutdown tasks.
    """
    # Startup
    logger.info("GOGGA API Starting...")
    logger.info("Environment: %s", settings.PAYFAST_ENV)
    logger.info("FREE Tier: OpenRouter Llama 3.3 70B")
    logger.info("JIVE Tier: Cerebras %s + CePO", settings.MODEL_CEPO)
    logger.info("JIGGA Tier: Cerebras %s (thinking)", settings.MODEL_COMPLEX)
    logger.info("CePO Enabled: %s (URL: %s)", settings.CEPO_ENABLED, settings.CEPO_URL)
    
    # Start the scheduler for subscription management
    scheduler_service.start()
    
    yield
    
    # Shutdown
    logger.info("GOGGA API Shutting down...")
    scheduler_service.stop()
    posthog_service.flush()  # Ensure all PostHog events are sent


# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "GOGGA - A Sovereign Bicameral AI Architecture for the South African Digital Ecosystem. "
        "This API provides chat completions using a two-tier model strategy: "
        "Speed Layer (Llama 3.1 8B) for fast responses and Complex Layer (Qwen 3 235B) "
        "for advanced reasoning, legal analysis, and translation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://gogga.app",
        "https://www.gogga.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
app.add_exception_handler(GoggaException, gogga_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next: Callable) -> Response:
    """Log all incoming requests with timing."""
    start_time = datetime.now(timezone.utc)
    response: Response = await call_next(request)
    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    
    logger.info(
        "%s %s - %d (%.3fs)",
        request.method, request.url.path, response.status_code, duration
    )
    
    return response


# Include API routers
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(images.router, prefix=settings.API_V1_STR)
app.include_router(prompts.router, prefix=settings.API_V1_STR)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "description": "Sovereign Bicameral AI for South Africa",
        "docs": "/docs",
        "health": "/health"
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint for monitoring.
    Shows status of all services, tiers, and system info.
    """
    import platform
    import psutil
    import os
    
    from app.services.ai_service import ai_service
    from app.services.cepo_service import cepo_service
    from app.services.openrouter_service import openrouter_service
    from app.core.router import UserTier, IMAGE_LIMITS
    
    start_time = datetime.now(timezone.utc)
    
    # Check all services in parallel
    cerebras_status = await ai_service.health_check()
    cepo_status = await cepo_service.health_check() if settings.CEPO_ENABLED else {"status": "disabled"}
    openrouter_status = await openrouter_service.health_check()
    
    # Calculate overall status
    overall = "healthy"
    issues = []
    
    if cerebras_status.get("status") != "healthy":
        overall = "degraded"
        issues.append("Cerebras unavailable - JIVE/JIGGA text affected")
    
    if cepo_status.get("status") not in ("healthy", "disabled"):
        if overall == "healthy":
            overall = "degraded"
        issues.append("CePO unavailable - JIVE reasoning fallback to direct")
    
    if openrouter_status.get("status") != "healthy":
        if overall == "healthy":
            overall = "degraded"
        issues.append("OpenRouter unavailable - FREE tier affected")
    
    # System metrics
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        system_metrics = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "percent": round(disk.percent, 1)
            }
        }
    except Exception:
        system_metrics = {"error": "psutil not available"}
    
    check_duration = (datetime.now(timezone.utc) - start_time).total_seconds()
    
    return {
        "status": overall,
        "issues": issues if issues else None,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "check_duration_seconds": round(check_duration, 3),
        
        # Environment info
        "environment": {
            "mode": settings.PAYFAST_ENV,
            "python": platform.python_version(),
            "platform": platform.system(),
            "hostname": os.environ.get("HOSTNAME", "unknown")
        },
        
        # Service health
        "services": {
            "cerebras": {
                **cerebras_status,
                "models": {
                    "jive": settings.MODEL_CEPO,
                    "jigga": settings.MODEL_COMPLEX
                },
                "tiers_affected": ["jive", "jigga"]
            },
            "cepo": {
                **cepo_status,
                "url": settings.CEPO_URL if settings.CEPO_ENABLED else None,
                "enabled": settings.CEPO_ENABLED,
                "tiers_affected": ["jive (reasoning)"]
            },
            "openrouter": {
                **openrouter_status,
                "models": {
                    "text": settings.OPENROUTER_MODEL_LLAMA,
                    "image": settings.OPENROUTER_MODEL_LONGCAT
                },
                "tiers_affected": ["free", "all (prompt enhancement)"]
            },
            "deepinfra": {
                "status": "configured" if settings.DEEPINFRA_API_KEY else "unconfigured",
                "model": settings.DEEPINFRA_IMAGE_MODEL,
                "tiers_affected": ["jive", "jigga"]
            }
        },
        
        # Tier configuration
        "tiers": {
            "free": {
                "text": "OpenRouter Llama 3.3 70B FREE",
                "images": f"Pollinations.ai ({IMAGE_LIMITS[UserTier.FREE]}/month)",
                "cost": "FREE"
            },
            "jive": {
                "text": "Cerebras Llama 3.1 8B + CePO",
                "images": f"FLUX 1.1 Pro ({IMAGE_LIMITS[UserTier.JIVE]}/month)",
                "cost": "Subscription"
            },
            "jigga": {
                "text": "Cerebras Qwen 3 235B (think/no_think)",
                "images": f"FLUX 1.1 Pro ({IMAGE_LIMITS[UserTier.JIGGA]}/month)",
                "cost": "Premium"
            }
        },
        
        # System metrics
        "system": system_metrics,
        
        # API endpoints
        "endpoints": {
            "chat": "/api/v1/chat",
            "images": "/api/v1/images/generate",
            "enhance": "/api/v1/chat/enhance",
            "tiers": "/api/v1/chat/tiers",
            "docs": "/docs"
        }
    }


# Simplified health for container probes
@app.get("/health/live")
async def liveness_check():
    """Liveness probe - is the app running?"""
    return {"alive": True, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/health/ready")
async def readiness_check():
    """Readiness probe - can the app handle traffic?"""
    from app.services.ai_service import ai_service
    
    cerebras = await ai_service.health_check()
    ready = cerebras.get("status") == "healthy"
    
    return {
        "ready": ready,
        "cerebras": cerebras.get("status"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Ready check endpoint (legacy)
@app.get("/ready")
async def ready_check():
    """Readiness check for Kubernetes/Azure."""
    return {"ready": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
