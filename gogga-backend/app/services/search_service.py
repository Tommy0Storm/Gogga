"""
GOGGA Search Service - Enterprise Web Search with Serper.dev + Async Scraping

Features:
- Serper.dev Google Search API integration
- Async web scraping with httpx + BeautifulSoup
- Rate limiting and caching
- Token-aware content truncation for LLM processing
- SA-specific search optimization (geo, language)

Architecture:
1. Serper.dev → Get top N search results
2. Async scrape → Fetch full page content in parallel
3. Clean & truncate → Prepare for LLM context
4. Return structured results → Ready for Qwen processing
"""
import asyncio
import hashlib
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Final
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import settings

logger = logging.getLogger(__name__)

# Configuration
SERPER_API_URL: Final[str] = "https://google.serper.dev/search"
SERPER_TIMEOUT: Final[float] = 10.0
SCRAPE_TIMEOUT: Final[float] = 15.0
MAX_CONCURRENT_SCRAPES: Final[int] = 5
MAX_CONTENT_CHARS: Final[int] = 8000  # Per page, ~2000 tokens
MAX_TOTAL_CONTEXT: Final[int] = 32000  # Total context for LLM
CACHE_TTL_SECONDS: Final[int] = 3600  # 1 hour cache

# Rate limiting
SERPER_RATE_LIMIT: Final[int] = 100  # requests per minute
SCRAPE_RATE_LIMIT: Final[int] = 30   # scrapes per minute per domain


@dataclass
class SearchResult:
    """Single search result with optional scraped content."""
    url: str
    title: str
    snippet: str
    position: int
    date: str | None = None
    full_content: str | None = None
    scrape_success: bool = False
    scrape_error: str | None = None
    content_tokens: int = 0


@dataclass
class SearchResponse:
    """Complete search response with metadata."""
    query: str
    results: list[SearchResult]
    total_results: int
    search_time_ms: int
    scrape_time_ms: int
    cached: bool = False
    credits_used: int = 1
    metadata: dict = field(default_factory=dict)


@dataclass
class CacheEntry:
    """Cache entry with TTL."""
    data: Any
    expires_at: float


class SearchService:
    """
    Enterprise search service with Serper.dev and async scraping.
    
    Features:
    - Google search via Serper.dev API
    - Parallel async page scraping
    - In-memory caching with TTL
    - Rate limiting per domain
    - Content cleaning and token truncation
    """
    
    _instance: "SearchService | None" = None
    _client: httpx.AsyncClient | None = None
    
    def __new__(cls) -> "SearchService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._cache: dict[str, CacheEntry] = {}
        self._rate_limits: dict[str, list[float]] = {}
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_SCRAPES)
        logger.info("SearchService initialized")
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(SCRAPE_TIMEOUT),
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-ZA,en;q=0.9,af;q=0.8",
                },
            )
        return self._client
    
    def _get_cache_key(self, query: str, **kwargs) -> str:
        """Generate cache key from query and params."""
        key_data = f"{query}:{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _get_cached(self, key: str) -> Any | None:
        """Get cached value if not expired."""
        if key in self._cache:
            entry = self._cache[key]
            if time.time() < entry.expires_at:
                return entry.data
            del self._cache[key]
        return None
    
    def _set_cache(self, key: str, data: Any, ttl: int = CACHE_TTL_SECONDS) -> None:
        """Set cache with TTL."""
        self._cache[key] = CacheEntry(
            data=data,
            expires_at=time.time() + ttl,
        )
    
    def _check_rate_limit(self, domain: str, limit: int = SCRAPE_RATE_LIMIT) -> bool:
        """Check if domain is rate limited."""
        now = time.time()
        window_start = now - 60  # 1 minute window
        
        if domain not in self._rate_limits:
            self._rate_limits[domain] = []
        
        # Clean old entries
        self._rate_limits[domain] = [
            t for t in self._rate_limits[domain] if t > window_start
        ]
        
        if len(self._rate_limits[domain]) >= limit:
            return False
        
        self._rate_limits[domain].append(now)
        return True
    
    async def search(
        self,
        query: str,
        location: str = "South Africa",
        country: str = "za",
        language: str = "en",
        num_results: int = 10,
        time_filter: str | None = None,  # qdr:d, qdr:w, qdr:m, qdr:y
        scrape_pages: bool = True,
    ) -> SearchResponse:
        """
        Perform Google search via Serper.dev and optionally scrape results.
        
        Args:
            query: Search query
            location: Geographic location for results
            country: Country code (za, us, uk, etc.)
            language: Language code (en, af, zu, st, etc.)
            num_results: Number of results to return (max 100)
            time_filter: Time filter (qdr:d=day, qdr:w=week, qdr:m=month, qdr:y=year)
            scrape_pages: Whether to scrape full page content
            
        Returns:
            SearchResponse with results and metadata
        """
        start_time = time.perf_counter()
        
        # Check cache
        cache_key = self._get_cache_key(
            query, location=location, country=country, 
            language=language, num_results=num_results, 
            time_filter=time_filter, scrape_pages=scrape_pages
        )
        cached = self._get_cached(cache_key)
        if cached:
            logger.info(f"Cache hit for query: {query[:50]}...")
            cached.cached = True
            return cached
        
        # Call Serper.dev
        search_results, credits = await self._serper_search(
            query=query,
            location=location,
            country=country,
            language=language,
            num_results=num_results,
            time_filter=time_filter,
        )
        search_time = int((time.perf_counter() - start_time) * 1000)
        
        # Scrape pages if requested
        scrape_start = time.perf_counter()
        if scrape_pages and search_results:
            search_results = await self._scrape_results(search_results)
        scrape_time = int((time.perf_counter() - scrape_start) * 1000)
        
        # Build response
        response = SearchResponse(
            query=query,
            results=search_results,
            total_results=len(search_results),
            search_time_ms=search_time,
            scrape_time_ms=scrape_time,
            cached=False,
            credits_used=credits,
            metadata={
                "location": location,
                "country": country,
                "language": language,
                "time_filter": time_filter,
                "scraped": scrape_pages,
            },
        )
        
        # Cache response
        self._set_cache(cache_key, response)
        
        logger.info(
            f"Search completed: query='{query[:30]}...', results={len(search_results)}, "
            f"search={search_time}ms, scrape={scrape_time}ms"
        )
        
        return response
    
    async def _serper_search(
        self,
        query: str,
        location: str,
        country: str,
        language: str,
        num_results: int,
        time_filter: str | None,
    ) -> tuple[list[SearchResult], int]:
        """Call Serper.dev API."""
        client = await self._get_client()
        
        payload = {
            "q": query,
            "location": location,
            "gl": country,
            "hl": language,
            "num": min(num_results, 100),
        }
        
        if time_filter:
            payload["tbs"] = time_filter
        
        headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json",
        }
        
        try:
            response = await client.post(
                SERPER_API_URL,
                json=payload,
                headers=headers,
                timeout=SERPER_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Serper API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Serper request failed: {e}")
            raise
        
        # Parse results
        results = []
        for item in data.get("organic", []):
            results.append(SearchResult(
                url=item.get("link", ""),
                title=item.get("title", ""),
                snippet=item.get("snippet", ""),
                position=item.get("position", 0),
                date=item.get("date"),
            ))
        
        credits = data.get("credits", 1)
        return results, credits
    
    async def _scrape_results(
        self,
        results: list[SearchResult],
    ) -> list[SearchResult]:
        """Scrape full content from search results in parallel."""
        tasks = []
        for result in results:
            tasks.append(self._scrape_page(result))
        
        scraped = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Replace results with scraped versions
        final_results = []
        for i, item in enumerate(scraped):
            if isinstance(item, Exception):
                logger.warning(f"Scrape failed for {results[i].url}: {item}")
                results[i].scrape_error = str(item)
                final_results.append(results[i])
            else:
                final_results.append(item)
        
        return final_results
    
    async def _scrape_page(self, result: SearchResult) -> SearchResult:
        """Scrape a single page with rate limiting."""
        async with self._semaphore:
            domain = urlparse(result.url).netloc
            
            # Check rate limit
            if not self._check_rate_limit(domain):
                result.scrape_error = "Rate limited"
                return result
            
            # Skip non-scrapeable URLs
            if self._should_skip_url(result.url):
                result.scrape_error = "Skipped (non-scrapeable)"
                return result
            
            try:
                client = await self._get_client()
                response = await client.get(result.url)
                response.raise_for_status()
                
                # Parse and clean content
                content = self._extract_content(response.text)
                result.full_content = content
                result.scrape_success = True
                result.content_tokens = len(content) // 4  # Rough token estimate
                
            except httpx.TimeoutException:
                result.scrape_error = "Timeout"
            except httpx.HTTPStatusError as e:
                result.scrape_error = f"HTTP {e.response.status_code}"
            except Exception as e:
                result.scrape_error = str(e)[:100]
            
            return result
    
    def _should_skip_url(self, url: str) -> bool:
        """Check if URL should be skipped (PDFs, videos, etc.)."""
        skip_extensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".mp4", ".mp3"]
        skip_domains = ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "instagram.com", "facebook.com"]
        
        parsed = urlparse(url)
        
        # Check extension
        if any(parsed.path.lower().endswith(ext) for ext in skip_extensions):
            return True
        
        # Check domain
        if any(d in parsed.netloc.lower() for d in skip_domains):
            return True
        
        return False
    
    def _extract_content(self, html: str) -> str:
        """Extract and clean text content from HTML."""
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove unwanted elements
        for element in soup(["script", "style", "nav", "header", "footer", "aside", "iframe", "noscript"]):
            element.decompose()
        
        # Extract text from main content areas
        main_content = soup.find("main") or soup.find("article") or soup.find(class_=re.compile(r"content|article|post|body"))
        
        if main_content:
            text = main_content.get_text(separator=" ", strip=True)
        else:
            # Fallback to body
            text = soup.get_text(separator=" ", strip=True)
        
        # Clean whitespace
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        
        # Truncate to max chars
        if len(text) > MAX_CONTENT_CHARS:
            text = text[:MAX_CONTENT_CHARS] + "..."
        
        return text
    
    def format_for_llm(
        self,
        response: SearchResponse,
        include_full_content: bool = True,
        max_total_chars: int = MAX_TOTAL_CONTEXT,
    ) -> str:
        """
        Format search results for LLM context injection.
        
        Returns a structured text format optimized for Qwen processing.
        """
        parts = [
            f"[WEB SEARCH RESULTS]",
            f"Query: {response.query}",
            f"Results: {response.total_results} pages found",
            f"Search time: {response.search_time_ms}ms",
            "",
        ]
        
        current_chars = sum(len(p) for p in parts)
        
        for i, result in enumerate(response.results, 1):
            # Build result block
            result_parts = [
                f"--- Result {i} ---",
                f"Title: {result.title}",
                f"URL: {result.url}",
                f"Summary: {result.snippet}",
            ]
            
            if result.date:
                result_parts.append(f"Date: {result.date}")
            
            if include_full_content and result.full_content and result.scrape_success:
                result_parts.append(f"Content: {result.full_content}")
            
            result_parts.append("")  # Blank line between results
            
            result_text = "\n".join(result_parts)
            
            # Check if we'd exceed limit
            if current_chars + len(result_text) > max_total_chars:
                parts.append(f"\n[{len(response.results) - i + 1} more results truncated due to context limit]")
                break
            
            parts.append(result_text)
            current_chars += len(result_text)
        
        parts.append("[END SEARCH RESULTS]")
        
        return "\n".join(parts)
    
    async def search_places(
        self,
        query: str,
        location: str = "South Africa",
        num_results: int = 5,
    ) -> dict:
        """
        Search for places/businesses using Serper.dev Places API.
        
        Args:
            query: What to search for (e.g., "restaurants near me", "pharmacies")
            location: Location for the search (e.g., "Cape Town, South Africa")
            num_results: Number of results (1-20)
            
        Returns:
            Dict with places results formatted for LLM
        """
        start_time = time.perf_counter()
        
        # Enhanced location handling
        # If location is generic or empty, default to South Africa
        if not location or location.strip().lower() in ["", "unknown", "n/a", "none"]:
            location = "South Africa"
            logger.info(f"Places search: No specific location, defaulting to '{location}'")
        
        # Enhance query with location if not already included
        # This helps Serper.dev return better results
        enhanced_query = query
        location_lower = location.lower()
        query_lower = query.lower()
        
        # If query doesn't mention the location, include location context
        if not any(loc_part in query_lower for loc_part in location_lower.split(",")):
            # Only append location to query if it's specific enough (not just "South Africa")
            if location.lower() != "south africa" and len(location.split(",")) > 0:
                enhanced_query = f"{query} near {location}"
                logger.debug(f"Places search: Enhanced query to '{enhanced_query}'")
        
        # Check cache
        cache_key = self._get_cache_key(f"places:{enhanced_query}", location=location, num_results=num_results)
        cached = self._get_cached(cache_key)
        if cached:
            cached["cached"] = True
            return cached
        
        client = await self._get_client()
        
        payload = {
            "q": enhanced_query,
            "location": location,
            "gl": "za",  # South Africa
            "num": min(num_results, 20),
        }
        
        headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json",
        }
        
        try:
            response = await client.post(
                "https://google.serper.dev/places",
                json=payload,
                headers=headers,
                timeout=SERPER_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            
        except httpx.TimeoutException:
            logger.error(f"Places search timeout for query: {query}")
            return {
                "success": False,
                "error": "Search timed out. Please try again.",
                "context": "[Places search timed out. The search service took too long to respond. Please try a more specific search or try again later.]",
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Places search HTTP error: {e.response.status_code} - {e.response.text}")
            return {
                "success": False,
                "error": f"Search service error: {e.response.status_code}",
                "context": f"[Places search failed: HTTP {e.response.status_code}. Please try again.]",
            }
        except Exception as e:
            logger.error(f"Places search failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "context": f"[Places search failed: {str(e)}]",
            }
        
        search_time = int((time.perf_counter() - start_time) * 1000)
        
        # Parse places results
        places = data.get("places", [])
        
        # Format for LLM
        parts = [
            f"[PLACES SEARCH RESULTS]",
            f"Query: {query}",
            f"Location: {location}",
            f"Results: {len(places)} places found",
            "",
        ]
        
        for i, place in enumerate(places[:num_results], 1):
            parts.append(f"--- Place {i} ---")
            parts.append(f"Name: {place.get('title', 'Unknown')}")
            parts.append(f"Address: {place.get('address', 'N/A')}")
            
            if place.get("rating"):
                rating = place["rating"]
                count = place.get("ratingCount", "?")
                parts.append(f"Rating: {rating}/5 ({count} reviews)")
            
            if place.get("category"):
                parts.append(f"Category: {place['category']}")
            
            if place.get("phoneNumber"):
                parts.append(f"Phone: {place['phoneNumber']}")
            
            if place.get("website"):
                parts.append(f"Website: {place['website']}")
            
            # Add coordinates if available (for maps integration)
            if place.get("latitude") and place.get("longitude"):
                parts.append(f"Coordinates: {place['latitude']}, {place['longitude']}")
            
            parts.append("")  # Blank line
        
        parts.append("[END PLACES RESULTS]")
        
        result = {
            "success": True,
            "context": "\n".join(parts),
            "places_count": len(places),
            "search_time_ms": search_time,
            "cached": False,
            "credits_used": 1,
            "places": [
                {
                    "name": p.get("title"),
                    "address": p.get("address"),
                    "rating": p.get("rating"),
                    "rating_count": p.get("ratingCount"),
                    "category": p.get("category"),
                    "phone": p.get("phoneNumber"),
                    "website": p.get("website"),
                    "lat": p.get("latitude"),
                    "lng": p.get("longitude"),
                }
                for p in places[:num_results]
            ],
        }
        
        # Cache result
        self._set_cache(cache_key, result)
        
        logger.info(f"Places search: query='{query[:30]}', location='{location}', results={len(places)}")
        
        return result
    
    async def close(self) -> None:
        """Clean up resources."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._cache.clear()
        logger.info("SearchService closed")


# Singleton accessor
def get_search_service() -> SearchService:
    """Get the search service singleton."""
    return SearchService()
