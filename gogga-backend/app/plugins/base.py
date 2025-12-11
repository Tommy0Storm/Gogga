"""
Base plugin protocol for GOGGA chat pipeline.
All plugins must implement this interface.

Plugins run on EVERY chat request and cannot be disabled.
They enrich context before sending to LLM and can transform responses.
"""

from typing import Protocol, Dict, Any, runtime_checkable


@runtime_checkable
class Plugin(Protocol):
    """
    Base protocol that all GOGGA plugins must implement.
    
    Plugins modify requests before sending to LLM and/or responses after.
    They run automatically on every message and cannot be disabled by users.
    
    Examples:
        - Language detection (enriches context with language metadata)
        - Profanity filter (sanitizes input/output)
        - Context enrichment (adds RAG context, user profile, etc.)
    """
    
    name: str
    """Unique identifier for the plugin (used in logs and metadata)"""
    
    async def before_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process request before sending to LLM.
        
        This is where plugins analyze user input, detect patterns, and enrich
        the request with metadata or modify the message content.
        
        Args:
            request: Chat completion request containing:
                - messages: List[Dict] - Chat messages
                - model: str - Target model name
                - metadata: Dict - Request metadata (can be modified)
                - temperature: float - Sampling temperature
                - max_tokens: int - Maximum response tokens
                
        Returns:
            Modified request dict (or original if no changes needed)
            
        Note:
            - Plugins can add to request["metadata"] for telemetry
            - Plugins can modify messages (add system prompts, etc.)
            - Must return the full request dict
        """
        ...
    
    async def after_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process response after receiving from LLM.
        
        This is where plugins can transform the LLM output, add metadata,
        or implement post-processing logic.
        
        Args:
            response: LLM response containing:
                - content: str - Generated text
                - model: str - Model that generated response
                - usage: Dict - Token usage statistics
                - metadata: Dict - Response metadata
                
        Returns:
            Modified response dict (or original if no changes needed)
            
        Note:
            - Plugins can modify response["content"] for transformations
            - Plugins can add to response["metadata"] for analytics
            - Must return the full response dict
        """
        ...
