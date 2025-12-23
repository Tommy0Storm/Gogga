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
from app.api.v1.endpoints import chat, payments, images, prompts, tools, gogga_talk, media, admin, icons
from app.api.v1 import tts
from app.services.posthog_service import posthog_service
from app.services.scheduler_service import scheduler_service
from app.core.exceptions import (
    GoggaException,
    gogga_exception_handler,
    general_exception_handler
)
from app.core.compression import zstd_compress_response, is_zstd_available


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
    logger.info("FREE Tier: OpenRouter Qwen 3 235B")
    logger.info("JIVE Tier: Cerebras %s (thinking)", settings.MODEL_JIVE)
    logger.info("JIGGA Tier: Cerebras %s (general) + %s (complex/legal)", settings.MODEL_JIGGA, settings.MODEL_JIGGA_235B)
    
    # Performance: Increase thread pool for Cerebras SDK blocking calls (Dec 2025 Audit)
    # Default is 8 workers - under load, requests queue in thread pool
    import asyncio
    import concurrent.futures
    loop = asyncio.get_event_loop()
    loop.set_default_executor(
        concurrent.futures.ThreadPoolExecutor(max_workers=64, thread_name_prefix="gogga_worker")
    )
    logger.info("ThreadPoolExecutor configured: 64 workers")
    
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
        "http://localhost:3002",
        "http://localhost:3100",  # Admin panel
        "https://localhost:3000",
        "https://localhost:3002",
        "http://192.168.0.130:3000",
        "http://192.168.0.130:3002",
        "https://192.168.0.130:3000",
        "https://192.168.0.130:3002",
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


# Zstd compression middleware for non-streaming JSON responses
# Synergy: Python 3.14 PEP 784 + React 19.2 cacheSignal for efficient data transfer
@app.middleware("http")
async def zstd_compression_middleware(request: Request, call_next: Callable) -> Response:
    """Compress JSON responses with Zstandard when client supports it."""
    response: Response = await call_next(request)
    
    # Skip if client doesn't accept zstd, or response is streaming/small
    accept_encoding = request.headers.get("Accept-Encoding", "")
    content_type = response.headers.get("Content-Type", "")
    
    # Only compress JSON responses (not SSE streams)
    if (
        "zstd" not in accept_encoding
        or "text/event-stream" in content_type
        or "application/json" not in content_type
    ):
        return response
    
    # Read response body for compression
    if hasattr(response, "body"):
        body = response.body
        if len(body) >= 512 and is_zstd_available():  # Lower threshold for chat (high compressibility)
            compressed, headers = zstd_compress_response(body, min_size=512, level=3)
            if headers:  # Compression was successful
                for key, value in headers.items():
                    response.headers[key] = value
                return Response(
                    content=compressed,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
    
    return response


# Include API routers
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(images.router, prefix=settings.API_V1_STR)
app.include_router(prompts.router, prefix=settings.API_V1_STR)
app.include_router(tools.router, prefix=f"{settings.API_V1_STR}/tools")
app.include_router(gogga_talk.router, prefix=f"{settings.API_V1_STR}/voice")
app.include_router(media.router, prefix=settings.API_V1_STR)
app.include_router(icons.router, prefix=f"{settings.API_V1_STR}/icons", tags=["icons"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(tts.router, prefix=settings.API_V1_STR)


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


# -----------------------------------------------------------------------------
# ADMIN: OpenRouter Fallback Toggle
# -----------------------------------------------------------------------------
from app.core.router import set_openrouter_fallback, get_openrouter_fallback

@app.get("/api/v1/admin/openrouter-fallback")
async def get_fallback_status():
    """Get current OpenRouter fallback status."""
    return {
        "enabled": get_openrouter_fallback(),
        "description": "When enabled, JIVE/JIGGA tiers route to OpenRouter instead of Cerebras"
    }

@app.post("/api/v1/admin/openrouter-fallback")
async def toggle_fallback(enabled: bool):
    """Toggle OpenRouter fallback for JIVE/JIGGA tiers."""
    set_openrouter_fallback(enabled)
    logger.info(f"OpenRouter fallback {'ENABLED' if enabled else 'DISABLED'} by admin")
    return {
        "success": True,
        "enabled": enabled,
        "message": f"OpenRouter fallback {'enabled' if enabled else 'disabled'}. JIVE/JIGGA will use {'OpenRouter' if enabled else 'Cerebras'}."
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
    from app.services.openrouter_service import openrouter_service
    from app.core.router import UserTier, IMAGE_LIMITS
    
    start_time = datetime.now(timezone.utc)
    
    # Check all services in parallel
    cerebras_status = await ai_service.health_check()
    openrouter_status = await openrouter_service.health_check()
    
    # Calculate overall status
    overall = "healthy"
    issues = []
    
    if cerebras_status.get("status") != "healthy":
        overall = "degraded"
        issues.append("Cerebras unavailable - JIVE/JIGGA text affected")
    
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
                    "jive": settings.MODEL_JIVE,
                    "jigga": settings.MODEL_JIGGA,
                    "jigga_complex": settings.MODEL_JIGGA_235B
                },
                "tiers_affected": ["jive", "jigga"]
            },
            "openrouter": {
                **openrouter_status,
                "models": {
                    "text": settings.OPENROUTER_MODEL_QWEN,
                    "image": settings.OPENROUTER_MODEL_LONGCAT
                },
                "tiers_affected": ["free", "all (prompt enhancement)"]
            },
            "vertex_ai": {
                "status": "configured" if settings.VERTEX_PROJECT_ID else "unconfigured",
                "models": {
                    "imagen": settings.IMAGEN_V3_MODEL,
                    "veo": settings.VEO_MODEL
                },
                "tiers_affected": ["jive", "jigga"]
            }
        },
        
        # Tier configuration - SIMPLIFIED (2025-01)
        # JIVE and JIGGA are IDENTICAL in features, only token/image limits differ
        "tiers": {
            "free": {
                "text": "OpenRouter Qwen 3 235B FREE",
                "images": f"Pollinations.ai ({IMAGE_LIMITS[UserTier.FREE]}/month)",
                "cost": "FREE"
            },
            "jive": {
                "text": f"Cerebras {settings.MODEL_JIVE} (general/math) + {settings.MODEL_JIGGA_235B} (complex/legal/extended)",
                "images": f"Imagen 3.0 ({IMAGE_LIMITS[UserTier.JIVE]}/month)",
                "cost": "Subscription"
            },
            "jigga": {
                "text": f"Cerebras {settings.MODEL_JIGGA} (general/math) + {settings.MODEL_JIGGA_235B} (complex/legal/extended)",
                "images": f"Imagen 3.0 ({IMAGE_LIMITS[UserTier.JIGGA]}/month)",
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
