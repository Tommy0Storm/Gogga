"""
GOGGA Chat Endpoints
Handles chat completions using the Tricameral AI architecture.

Layers:
- Speed: Fast responses (Llama 3.1 8B)
- Complex: Advanced reasoning (Qwen 3 235B)  
- Reasoning: CePO-optimized multi-step planning (Qwen 3 235B + OptiLLM)
"""
import logging

from fastapi import APIRouter, HTTPException

from app.models.domain import ChatRequest, ChatResponse
from app.services.ai_service import ai_service
from app.core.router import CognitiveLayer
from app.core.exceptions import InferenceError


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Send a message to Gogga and receive a response.
    
    The Tricameral Router automatically selects the appropriate layer:
    - Speed Layer (Llama 3.1 8B): For simple queries, greetings
    - Complex Layer (Qwen 3 235B): For legal, coding, translation queries
    - Reasoning Layer (Qwen 3 235B + CePO): For multi-step planning tasks
    
    Args:
        request: ChatRequest containing message, user_id, and optional history
        
    Returns:
        ChatResponse with the AI response and metadata
    """
    try:
        # Convert history to the expected format
        history = (
            [{"role": m.role, "content": m.content} for m in request.history]
            if request.history
            else None
        )
        
        # Determine if force_model should override routing
        force_layer = _resolve_force_layer(request.force_model)
        
        result = await ai_service.generate_response(
            user_id=request.user_id,
            message=request.message,
            history=history,
            force_layer=force_layer
        )
        
        return ChatResponse(
            response=result["response"],
            meta={
                "model_used": result["meta"]["model_used"],
                "layer": result["meta"]["layer"],
                "latency_seconds": result["meta"]["latency_seconds"],
                "tokens": {
                    "input": result["meta"]["tokens"]["input"],
                    "output": result["meta"]["tokens"]["output"]
                },
                "cost_usd": result["meta"]["cost_usd"],
                "cost_zar": result["meta"]["cost_zar"]
            }
        )
        
    except InferenceError as e:
        logger.error(f"Inference error for user {request.user_id}: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error for user {request.user_id}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


def _resolve_force_layer(force_model: str | None) -> CognitiveLayer | None:
    """Resolve force_model string to CognitiveLayer enum."""
    if not force_model:
        return None
    
    force_model_lower = force_model.lower()
    if "speed" in force_model_lower or "llama" in force_model_lower:
        return CognitiveLayer.SPEED
    if "reasoning" in force_model_lower or "cepo" in force_model_lower:
        return CognitiveLayer.REASONING
    if "complex" in force_model_lower or "qwen" in force_model_lower:
        return CognitiveLayer.COMPLEX
    
    return None


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream a response from Gogga (Server-Sent Events).
    
    Note: This is a placeholder for streaming implementation.
    In production, this would use Cerebras streaming API.
    """
    logger.info(f"Streaming requested by user {request.user_id} - not yet implemented")
    raise HTTPException(
        status_code=501,
        detail="Streaming not yet implemented"
    )


@router.get("/models")
async def list_models():
    """
    List available models and their characteristics.
    """
    from app.config import settings
    
    return {
        "models": [
            {
                "id": settings.MODEL_SPEED,
                "name": "Llama 3.1 8B",
                "layer": "speed",
                "description": "Fast inference for simple queries",
                "speed": "~2,200 tokens/second",
                "cost": {
                    "input": f"${settings.COST_SPEED_INPUT}/M tokens",
                    "output": f"${settings.COST_SPEED_OUTPUT}/M tokens"
                }
            },
            {
                "id": settings.MODEL_COMPLEX,
                "name": "Qwen 3 235B",
                "layer": "complex",
                "description": "Advanced reasoning for legal, coding, translation",
                "speed": "~1,400 tokens/second",
                "cost": {
                    "input": f"${settings.COST_COMPLEX_INPUT}/M tokens",
                    "output": f"${settings.COST_COMPLEX_OUTPUT}/M tokens"
                }
            },
            {
                "id": f"{settings.MODEL_COMPLEX}+cepo",
                "name": "Qwen 3 235B + CePO",
                "layer": "reasoning",
                "description": "CePO-optimized multi-step planning and reasoning",
                "speed": "Variable (depends on planning depth)",
                "cost": {
                    "input": f"${settings.COST_COMPLEX_INPUT}/M tokens",
                    "output": f"${settings.COST_COMPLEX_OUTPUT}/M tokens",
                    "note": "May use additional tokens for planning iterations"
                }
            }
        ]
    }
