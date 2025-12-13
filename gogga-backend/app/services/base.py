"""
Base service definitions with deferred annotation evaluation (Python 3.14 style).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # Deferred imports for faster startup and type safety
    from httpx import AsyncClient
    from pydantic import BaseModel
    from app.models.domain import ChatRequest


class BaseService:
    client: "AsyncClient" | None = None

    async def process_request(
        self,
        request: "ChatRequest",
        response_model: type["BaseModel"],
    ) -> "BaseModel":
        """Process a request and return a typed response. Implement in subclasses."""
        raise NotImplementedError
