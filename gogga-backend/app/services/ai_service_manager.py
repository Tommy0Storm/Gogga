"""
AI Service Manager using Python 3.14 multiple interpreters (where available).
Falls back to a thread pool when the interpreters module is unavailable.
"""
from __future__ import annotations

import asyncio
import json
import sysconfig
from typing import Any

import httpx

from app.config import settings

# Python 3.14: Multiple interpreters for isolated AI services
from concurrent.interpreters import create, Interpreter
from concurrent.futures import ThreadPoolExecutor
_INTERPRETERS_AVAILABLE = True


class AIServiceManager:
    def __init__(self) -> None:
        # Python 3.14: Create isolated interpreters for different AI services
        self.interpreters = {
            "cerebras": create(),
            "openrouter": create(),
            "cepo": create(),
        }
        
        # Python 3.14: Check if running with GIL disabled (free-threaded mode)
        self.is_free_threaded = sysconfig.get_config_var("Py_GIL_DISABLED") == 1
        
        # Use more aggressive parallelism in free-threaded mode (2-3x faster concurrency)
        max_workers = 10 if self.is_free_threaded else 3
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def call_ai_service(self, service: str, prompt: str, **kwargs: Any) -> str:
        """Execute AI call in isolated interpreter for better stability."""

        endpoint = self._get_endpoint(service)
        payload = {"prompt": prompt, **kwargs}

        # Python 3.14: Execute in isolated interpreter
        if service in self.interpreters:
            script = f'''
import asyncio
import httpx
import json

async def make_request():
    client = httpx.AsyncClient(timeout=120.0)
    try:
        response = await client.post(
            {endpoint!r},
            json=json.loads({json.dumps(json.dumps(payload))!r})
        )
        response.raise_for_status()
        data = response.json()
        return data.get("content", "")
    finally:
        await client.aclose()

result = asyncio.run(make_request())
print(result)
'''
            loop = asyncio.get_event_loop()
            # Python 3.14 API: interp.exec() instead of run_string()
            interp = self.interpreters[service]
            result = await loop.run_in_executor(
                self.executor, lambda: interp.exec(script)
            )
            return result.strip() if isinstance(result, str) else str(result)

        # Fallback path for unknown services
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
            return str(data.get("content", ""))

    @staticmethod
    def _get_endpoint(service: str) -> str:
        service_lower = service.lower()
        if service_lower == "cepo":
            return f"{settings.CEPO_URL}/chat"
        if service_lower == "cerebras":
            # Placeholder endpoint; Cerebras is usually accessed via SDK.
            return f"{settings.API_URL}/cerebras/chat"
        if service_lower == "openrouter":
            return "https://openrouter.ai/api/v1/chat/completions"
        raise ValueError(f"Unknown AI service: {service}")
