"""
GOGGA AI Service
Encapsulates interaction with the Cerebras Cloud SDK.
Implements the Bicameral routing strategy between Speed and Complex layers.
"""
import logging
import time
import asyncio
from typing import Any, Final

from cerebras.cloud.sdk import Cerebras

from app.config import settings
from app.core.router import bicameral_router, CognitiveLayer
from app.services.cost_tracker import track_usage
from app.core.exceptions import InferenceError


# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_HISTORY_TURNS: Final[int] = 5
DEFAULT_TEMPERATURE: Final[float] = 0.7
DEFAULT_MAX_TOKENS: Final[int] = 2048
DEFAULT_TOP_P: Final[float] = 0.95

# Type aliases
MessageDict = dict[str, str]
ResponseDict = dict[str, Any]


# Initialize the Cerebras client lazily for better error handling
_client: Cerebras | None = None


def get_client() -> Cerebras:
    """Get or create the Cerebras client instance."""
    global _client
    if _client is None:
        _client = Cerebras(api_key=settings.CEREBRAS_API_KEY)
    return _client


class AIService:
    """
    AI Service for handling chat completions using the Quadricameral Architecture.
    
    The service routes requests between four cognitive layers:
    - Speed Layer: Llama 3.1 8B (~2,200 tok/s) - Fast factual responses
    - Complex Layer: Qwen 3 235B (~1,400 tok/s) - Nuanced conversations
    - Reasoning Layer: Llama 3.1 8B + CePO - Fast multi-step reasoning
    - Deep Reasoning: Qwen 3 235B + CePO - Complex analysis & planning
    """
    
    @staticmethod
    async def generate_response(
        user_id: str,
        message: str,
        history: list[MessageDict] | None = None,
        force_layer: CognitiveLayer | str | None = None
    ) -> ResponseDict:
        """
        Executes the inference request using the selected model.
        Tracks precise token usage and calculates cost.
        
        Args:
            user_id: Unique identifier for the user
            message: The user's input message
            history: Optional conversation history (last 5 turns used)
            force_layer: Optional layer override (CognitiveLayer or string)
            
        Returns:
            Dict containing the response and metadata
            
        Raises:
            InferenceError: If the inference fails
        """
        # Determine which layer to use
        layer = AIService._resolve_layer(message, force_layer)
        
        # Use CePO for REASONING (Llama) or DEEP_REASONING (Qwen)
        if layer in (CognitiveLayer.REASONING, CognitiveLayer.DEEP_REASONING):
            return await AIService._generate_with_cepo(
                user_id, message, history, layer
            )
        
        model_id = bicameral_router.get_model_id(layer)
        system_prompt = bicameral_router.get_system_prompt(layer)
        
        start_time = time.perf_counter()  # More precise than time.time()
        
        # Construct the context window
        messages = AIService._build_messages(system_prompt, history, message)
        
        try:
            response = await AIService._execute_inference(messages, model_id)
            return await AIService._process_response(
                response, user_id, model_id, layer, start_time
            )
            
        except Exception as e:
            logger.error(f"Inference Error: {e}")
            return await AIService._handle_inference_error(
                e, layer, user_id, message, history
            )
    
    @staticmethod
    def _resolve_layer(
        message: str,
        force_layer: CognitiveLayer | str | None
    ) -> CognitiveLayer:
        """Resolve the cognitive layer to use."""
        if force_layer is not None:
            if isinstance(force_layer, CognitiveLayer):
                return force_layer
            if force_layer in ("speed", "complex", "reasoning", "deep_reasoning"):
                return CognitiveLayer(force_layer)
        return bicameral_router.classify_intent(message)
    
    @staticmethod
    def _build_messages(
        system_prompt: str,
        history: list[MessageDict] | None,
        message: str
    ) -> list[MessageDict]:
        """Build the message list for the API call."""
        messages: list[MessageDict] = [{"role": "system", "content": system_prompt}]
        
        if history:
            messages.extend(history[-MAX_HISTORY_TURNS:])
        
        messages.append({"role": "user", "content": message})
        return messages
    
    @staticmethod
    async def _execute_inference(
        messages: list[MessageDict],
        model_id: str
    ) -> Any:
        """Execute the inference call asynchronously."""
        client = get_client()
        return await asyncio.to_thread(
            client.chat.completions.create,
            messages=messages,
            model=model_id,
            temperature=DEFAULT_TEMPERATURE,
            max_tokens=DEFAULT_MAX_TOKENS,
            top_p=DEFAULT_TOP_P
        )
    
    @staticmethod
    async def _process_response(
        response: Any,
        user_id: str,
        model_id: str,
        layer: CognitiveLayer,
        start_time: float
    ) -> ResponseDict:
        """Process the API response and track usage."""
        usage = response.usage
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens
        content = response.choices[0].message.content
        
        latency = time.perf_counter() - start_time
        
        cost_data = await track_usage(
            user_id=user_id,
            model=model_id,
            layer=layer.value,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )
        
        return {
            "response": content,
            "meta": {
                "model_used": model_id,
                "layer": layer.value,
                "latency_seconds": round(latency, 3),
                "tokens": {
                    "input": input_tokens,
                    "output": output_tokens
                },
                "cost_usd": cost_data["usd"],
                "cost_zar": cost_data["zar"]
            }
        }
    
    @staticmethod
    async def _handle_inference_error(
        error: Exception,
        layer: CognitiveLayer,
        user_id: str,
        message: str,
        history: list[MessageDict] | None
    ) -> ResponseDict:
        """Handle inference errors with fallback logic."""
        # Fallback chain: DEEP_REASONING -> REASONING -> COMPLEX -> SPEED
        if layer == CognitiveLayer.DEEP_REASONING:
            logger.warning("Attempting fallback from Deep Reasoning to Reasoning...")
            try:
                return await AIService.generate_response(
                    user_id=user_id,
                    message=message,
                    history=history,
                    force_layer=CognitiveLayer.REASONING
                )
            except Exception:
                pass  # Continue to Complex fallback
        
        if layer in (CognitiveLayer.REASONING, CognitiveLayer.DEEP_REASONING):
            logger.warning("Attempting fallback to Complex layer...")
            try:
                return await AIService.generate_response(
                    user_id=user_id,
                    message=message,
                    history=history,
                    force_layer=CognitiveLayer.COMPLEX
                )
            except Exception:
                pass  # Continue to Speed layer fallback
        
        if layer in (CognitiveLayer.COMPLEX, CognitiveLayer.REASONING, CognitiveLayer.DEEP_REASONING):
            logger.warning("Attempting fallback to Speed layer...")
            try:
                return await AIService.generate_response(
                    user_id=user_id,
                    message=message,
                    history=history,
                    force_layer=CognitiveLayer.SPEED
                )
            except Exception as fallback_error:
                raise InferenceError(f"All layers failed: {fallback_error}") from fallback_error
        
        raise InferenceError(str(error)) from error
    
    @staticmethod
    async def _generate_with_cepo(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        layer: CognitiveLayer
    ) -> ResponseDict:
        """
        Generate response using CePO optimization.
        
        CePO provides multi-step planning and reasoning for complex tasks.
        - REASONING: Uses Llama 3.1 8B (~2200 tok/s) for fast reasoning
        - DEEP_REASONING: Uses Qwen 3 235B (~1400 tok/s) for deep analysis
        
        Falls back to standard layers if CePO is unavailable.
        """
        from app.services.cepo_service import cepo_service
        
        system_prompt = bicameral_router.get_system_prompt(layer)
        model_id = bicameral_router.get_model_id(layer)
        
        try:
            result = await cepo_service.generate_with_cepo(
                message=message,
                system_prompt=system_prompt,
                history=history,
                model=model_id  # Pass the appropriate model
            )
            
            # Track usage for CePO
            if "meta" in result and "tokens" in result["meta"]:
                await track_usage(
                    user_id=user_id,
                    model=result["meta"].get("model_used", model_id),
                    layer=layer.value,
                    input_tokens=result["meta"]["tokens"].get("input", 0),
                    output_tokens=result["meta"]["tokens"].get("output", 0)
                )
            
            return result
            
        except Exception as e:
            logger.warning("CePO generation failed, falling back: %s", e)
            # Fallback to non-CePO layer
            fallback_layer = (
                CognitiveLayer.COMPLEX if layer == CognitiveLayer.DEEP_REASONING
                else CognitiveLayer.SPEED
            )
            return await AIService.generate_response(
                user_id=user_id,
                message=message,
                history=history,
                force_layer=fallback_layer
            )
    
    @staticmethod
    async def health_check() -> ResponseDict:
        """
        Check the health of the Cerebras connection.
        
        Returns:
            Dict with status and latency information
        """
        try:
            start_time = time.perf_counter()
            
            client = get_client()
            await asyncio.to_thread(
                client.chat.completions.create,
                messages=[{"role": "user", "content": "Hi"}],
                model=settings.MODEL_SPEED,
                max_tokens=5
            )
            
            latency = time.perf_counter() - start_time
            
            return {
                "status": "healthy",
                "latency_ms": round(latency * 1000, 2)
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Singleton instance
ai_service = AIService()
