"""
Gogga Document Tool Executor - Tool Registration and Execution

Handles:
1. Tool definition for AI function calling
2. Execution when AI invokes generate_document
3. Validation and error handling
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from app.tools.document_definitions import (
    DOCUMENT_TOOL_DEFINITION,
    DocumentToolInput,
    DocumentToolOutput,
)

logger = logging.getLogger(__name__)


class DocumentToolExecutor:
    """
    Executor for the document generation tool.
    
    Registers with the tool calling system and handles
    invocation when AI calls generate_document.
    """
    
    def __init__(self) -> None:
        self._service = None  # Lazy init
    
    def _get_service(self):
        """Lazy load document service to avoid circular imports"""
        if self._service is None:
            from app.services.document_service import get_document_service
            self._service = get_document_service()
        return self._service
    
    @property
    def definition(self) -> dict[str, Any]:
        """Get tool definition for function calling registration"""
        return DOCUMENT_TOOL_DEFINITION
    
    @property
    def name(self) -> str:
        """Tool name for registration"""
        return "generate_document"
    
    async def execute(
        self,
        arguments: dict[str, Any],
        user_tier: str,
        language_intel: dict[str, Any] | None = None,
        user_id: str = "document_tool",
    ) -> dict[str, Any]:
        """
        Execute the document tool with given arguments.
        
        Called by the tool executor when AI invokes generate_document.
        
        Args:
            arguments: Tool call arguments from AI
            user_tier: User's subscription tier
            language_intel: Optional pre-detected language from plugin
            user_id: User identifier for cost tracking
            
        Returns:
            Tool result dict for AI to process
        """
        try:
            # Set defaults for optional fields
            if "formality" not in arguments:
                arguments["formality"] = "formal"
            if "include_sa_context" not in arguments:
                arguments["include_sa_context"] = True
            
            # Validate input
            input_data = DocumentToolInput(**arguments)
            
            logger.info(
                f"Document tool executing: type={input_data.document_type}, "
                f"lang={input_data.language}, formality={input_data.formality}"
            )
            
            # Generate document with user_id for cost tracking
            service = self._get_service()
            output = await service.generate(input_data, user_tier, language_intel, user_id)
            
            logger.info(
                f"Document generated: title='{output.title}', "
                f"words={output.word_count}, model={output.model_used}, "
                f"tokens={output.input_tokens}/{output.output_tokens}, "
                f"cost=${output.cost_usd:.6f}"
            )
            
            return {
                "success": True,
                "result": output.model_dump(),
                "display_type": "document",  # Frontend hint for rendering
                "type": "document",
            }
            
        except ValidationError as e:
            logger.warning(f"Document tool validation failed: {e.errors()}")
            return {
                "success": False,
                "error": f"Invalid input: {e.errors()}",
                "display_type": "alert_cards",
            }
        except Exception as e:
            logger.exception("Document tool execution failed")
            return {
                "success": False,
                "error": str(e),
                "display_type": "alert_cards",
            }


# Singleton instance
_document_executor: DocumentToolExecutor | None = None


def get_document_executor() -> DocumentToolExecutor:
    """Get or create the document executor singleton"""
    global _document_executor
    if _document_executor is None:
        _document_executor = DocumentToolExecutor()
    return _document_executor


async def execute_document_tool(
    arguments: dict[str, Any],
    user_tier: str,
    language_intel: dict[str, Any] | None = None,
    user_id: str = "document_tool",
) -> dict[str, Any]:
    """
    Convenience function to execute document tool.
    
    Called from tool_executor.py when handling generate_document calls.
    
    Args:
        arguments: Tool call arguments from AI
        user_tier: User's subscription tier
        language_intel: Optional pre-detected language from plugin
        user_id: User identifier for cost tracking
    """
    executor = get_document_executor()
    return await executor.execute(arguments, user_tier, language_intel, user_id)
