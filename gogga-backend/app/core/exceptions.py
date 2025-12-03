"""
GOGGA Custom Exception Handlers
Defines custom exceptions and handlers for the application.
"""
import logging

from fastapi import Request
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)


class GoggaException(Exception):
    """Base exception for GOGGA application."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class InferenceError(GoggaException):
    """Raised when AI inference fails."""
    def __init__(self, message: str = "AI inference failed"):
        super().__init__(message, status_code=503)


class PaymentError(GoggaException):
    """Raised when payment processing fails."""
    def __init__(self, message: str = "Payment processing failed"):
        super().__init__(message, status_code=402)


class RateLimitError(GoggaException):
    """Raised when rate limit is exceeded."""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status_code=429)


class QuotaExceededError(GoggaException):
    """Raised when user's token quota is exceeded."""
    def __init__(self, message: str = "Token quota exceeded. Please upgrade your subscription."):
        super().__init__(message, status_code=402)


async def gogga_exception_handler(request: Request, exc: GoggaException) -> JSONResponse:
    """Handler for GoggaException and its subclasses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.message,
            "type": exc.__class__.__name__
        }
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler for unexpected exceptions."""
    logger.exception("Unhandled exception for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "An unexpected error occurred",
            "type": "InternalServerError"
        }
    )
