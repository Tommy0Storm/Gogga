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
from app.api.v1.endpoints import chat, payments
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
    logger.info("Speed Model: %s", settings.MODEL_SPEED)
    logger.info("Complex Model: %s", settings.MODEL_COMPLEX)
    logger.info("CePO Enabled: %s (URL: %s)", settings.CEPO_ENABLED, settings.CEPO_URL)
    
    yield
    
    # Shutdown
    logger.info("GOGGA API Shutting down...")


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
    Health check endpoint for container orchestration.
    Used by Azure Container Apps for liveness/readiness probes.
    """
    from app.services.ai_service import ai_service
    from app.services.cepo_service import cepo_service
    
    # Check Cerebras connection
    cerebras_status = await ai_service.health_check()
    
    # Check CePO sidecar (optional)
    cepo_status = await cepo_service.health_check() if settings.CEPO_ENABLED else {"status": "disabled"}
    
    # Overall status: healthy if Cerebras works, degraded if CePO unavailable
    overall = "healthy"
    if cerebras_status["status"] != "healthy":
        overall = "unhealthy"
    elif cepo_status["status"] not in ("healthy", "disabled"):
        overall = "degraded"
    
    return {
        "status": overall,
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "cerebras": cerebras_status,
            "cepo": cepo_status
        }
    }


# Ready check endpoint
@app.get("/ready")
async def ready_check():
    """Readiness check for Kubernetes/Azure."""
    return {"ready": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
