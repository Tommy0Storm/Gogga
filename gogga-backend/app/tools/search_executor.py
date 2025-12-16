"""
GOGGA Search Tool Executor - Handles search tool calls from AI

This module executes search tool calls from the AI and returns
formatted results ready for LLM context injection.
"""
import logging
from typing import Any

from app.services.search_service import get_search_service, SearchResponse
from app.tools.search_definitions import parse_time_filter

logger = logging.getLogger(__name__)


async def execute_web_search(
    query: str,
    num_results: int = 5,
    time_filter: str = "any",
    scrape_content: bool = True,
    language: str = "en",
) -> dict[str, Any]:
    """
    Execute web search tool call.
    
    Args:
        query: Search query
        num_results: Number of results (1-10)
        time_filter: Time filter (day, week, month, year, any)
        scrape_content: Whether to scrape full page content
        language: Language code
        
    Returns:
        Dict with search results and formatted context
    """
    service = get_search_service()
    
    try:
        response = await service.search(
            query=query,
            num_results=min(num_results, 10),
            time_filter=parse_time_filter(time_filter),
            scrape_pages=scrape_content,
            language=language,
        )
        
        # Format for LLM
        context = service.format_for_llm(response, include_full_content=scrape_content)
        
        return {
            "success": True,
            "context": context,
            "results_count": response.total_results,
            "search_time_ms": response.search_time_ms,
            "scrape_time_ms": response.scrape_time_ms,
            "cached": response.cached,
            "credits_used": response.credits_used,
        }
        
    except Exception as e:
        logger.error(f"Web search failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "context": f"[Search failed: {str(e)}. Please try a different query or try again later.]",
        }


async def execute_legal_search(
    query: str,
    case_law: bool = True,
    legislation: bool = True,
    time_filter: str = "any",
) -> dict[str, Any]:
    """
    Execute legal search tool call.
    
    Enhances the query with SA legal context and searches
    legal databases and resources.
    """
    service = get_search_service()
    
    # Enhance query for legal context
    enhanced_query = query
    
    # Add site filters for SA legal sources
    legal_sites = []
    if case_law:
        legal_sites.extend([
            "saflii.org",
            "lawlibrary.org.za",
            "justice.gov.za",
            "ccma.org.za",
        ])
    if legislation:
        legal_sites.extend([
            "gov.za",
            "parliament.gov.za",
        ])
    
    # Build site-restricted query
    if legal_sites:
        site_filter = " OR ".join(f"site:{s}" for s in legal_sites[:3])
        enhanced_query = f"{query} ({site_filter})"
    
    try:
        response = await service.search(
            query=enhanced_query,
            num_results=8,  # More results for legal research
            time_filter=parse_time_filter(time_filter),
            scrape_pages=True,
            language="en",
        )
        
        # Format with legal context header
        context = service.format_for_llm(response, include_full_content=True)
        context = context.replace(
            "[WEB SEARCH RESULTS]",
            "[SA LEGAL SEARCH RESULTS]\nNote: These are search results, not legal advice. Verify with official sources."
        )
        
        return {
            "success": True,
            "context": context,
            "results_count": response.total_results,
            "search_time_ms": response.search_time_ms,
            "cached": response.cached,
        }
        
    except Exception as e:
        logger.error(f"Legal search failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "context": f"[Legal search failed: {str(e)}]",
        }


async def execute_shopping_search(
    query: str,
    num_results: int = 5,
) -> dict[str, Any]:
    """
    Execute shopping/price search tool call.
    
    Searches SA retailers for product prices and availability.
    """
    service = get_search_service()
    
    # Enhance query for shopping context
    shopping_query = f"{query} price South Africa ZAR buy"
    
    try:
        response = await service.search(
            query=shopping_query,
            num_results=min(num_results, 10),
            time_filter=parse_time_filter("month"),  # Recent prices only
            scrape_pages=True,
            language="en",
        )
        
        # Format with shopping context
        context = service.format_for_llm(response, include_full_content=True)
        context = context.replace(
            "[WEB SEARCH RESULTS]",
            "[SA SHOPPING RESULTS]\nNote: Prices may have changed. Check retailer sites for current pricing."
        )
        
        return {
            "success": True,
            "context": context,
            "results_count": response.total_results,
            "search_time_ms": response.search_time_ms,
            "cached": response.cached,
        }
        
    except Exception as e:
        logger.error(f"Shopping search failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "context": f"[Shopping search failed: {str(e)}]",
        }


async def execute_places_search(
    query: str,
    location: str = "South Africa",
    num_results: int = 5,
) -> dict[str, Any]:
    """
    Execute places/location search tool call.
    
    Searches for nearby businesses, restaurants, services, etc.
    Uses Serper.dev Places API.
    
    Args:
        query: What to search for (e.g., "restaurants", "pharmacies")
        location: Location for the search (e.g., "Cape Town, South Africa")
        num_results: Number of results (1-20)
        
    Returns:
        Dict with places results formatted for LLM context
    """
    service = get_search_service()
    
    try:
        result = await service.search_places(
            query=query,
            location=location,
            num_results=min(num_results, 20),
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Places search failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "context": f"[Places search failed: {str(e)}]",
        }


# All search tool names (used for server-side detection)
ALL_SEARCH_TOOL_NAMES = {"web_search", "legal_search", "shopping_search", "places_search"}


async def execute_search_tool(
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    """
    Execute any search tool by name.
    
    Args:
        tool_name: Name of the tool (web_search, legal_search, shopping_search, places_search)
        arguments: Tool arguments
        
    Returns:
        Tool execution result
    """
    executors = {
        "web_search": execute_web_search,
        "legal_search": execute_legal_search,
        "shopping_search": execute_shopping_search,
        "places_search": execute_places_search,
    }
    
    executor = executors.get(tool_name)
    if not executor:
        return {
            "success": False,
            "error": f"Unknown search tool: {tool_name}",
            "context": f"[Error: Unknown tool '{tool_name}']",
        }
    
    return await executor(**arguments)
