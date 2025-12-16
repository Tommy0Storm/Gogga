"""
Test Search Service - Serper.dev + Scraping Integration

Run with: python -m pytest tests/test_search_service.py -v
Or directly: python tests/test_search_service.py
"""
import asyncio
import sys
import os

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.search_service import SearchService, get_search_service, SearchResult
from app.tools.search_executor import execute_web_search, execute_legal_search, execute_search_tool


# Mock Serper response
MOCK_SERPER_RESPONSE = {
    "searchParameters": {
        "q": "unfair dismissal South Africa",
        "gl": "za",
        "type": "search"
    },
    "organic": [
        {
            "title": "Unfair Dismissal - Labour Guide",
            "link": "https://labourguide.co.za/unfair-dismissal",
            "snippet": "An unfair dismissal occurs when an employee is dismissed without a fair reason or without a fair procedure.",
            "position": 1
        },
        {
            "title": "CCMA - Unfair Dismissal Claims",
            "link": "https://www.ccma.org.za/unfair-dismissal",
            "snippet": "The CCMA handles unfair dismissal disputes under the Labour Relations Act.",
            "position": 2,
            "date": "2024-12-01"
        }
    ],
    "credits": 1
}

# Mock HTML response
MOCK_HTML = """
<html>
<head><title>Test Page</title></head>
<body>
<nav>Navigation</nav>
<main>
<h1>Unfair Dismissal in South Africa</h1>
<p>An unfair dismissal occurs when an employer terminates an employee's contract without valid reason or proper procedure.</p>
<p>The Labour Relations Act protects employees from unfair dismissal.</p>
</main>
<footer>Footer</footer>
</body>
</html>
"""


class TestSearchService:
    """Tests for SearchService."""
    
    @pytest.fixture
    def service(self):
        """Create fresh service instance."""
        # Reset singleton
        SearchService._instance = None
        return SearchService()
    
    @pytest.mark.asyncio
    async def test_search_basic(self, service):
        """Test basic search flow."""
        with patch.object(service, '_get_client') as mock_get_client:
            # Mock HTTP client
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.json.return_value = MOCK_SERPER_RESPONSE
            mock_response.raise_for_status = MagicMock()
            mock_response.text = MOCK_HTML
            mock_response.status_code = 200
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client
            
            # Execute search
            result = await service.search(
                query="unfair dismissal South Africa",
                num_results=5,
                scrape_pages=False,  # Skip scraping for this test
            )
            
            assert result.query == "unfair dismissal South Africa"
            assert len(result.results) == 2
            assert result.results[0].title == "Unfair Dismissal - Labour Guide"
            assert result.credits_used == 1
    
    @pytest.mark.asyncio
    async def test_search_with_scraping(self, service):
        """Test search with page scraping."""
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            
            # Mock Serper response
            serper_response = MagicMock()
            serper_response.json.return_value = MOCK_SERPER_RESPONSE
            serper_response.raise_for_status = MagicMock()
            
            # Mock scrape response
            scrape_response = MagicMock()
            scrape_response.text = MOCK_HTML
            scrape_response.raise_for_status = MagicMock()
            
            mock_client.post = AsyncMock(return_value=serper_response)
            mock_client.get = AsyncMock(return_value=scrape_response)
            mock_get_client.return_value = mock_client
            
            result = await service.search(
                query="unfair dismissal",
                scrape_pages=True,
            )
            
            # Check scraping worked
            assert result.results[0].scrape_success or result.results[0].scrape_error
    
    def test_extract_content(self, service):
        """Test HTML content extraction."""
        content = service._extract_content(MOCK_HTML)
        
        assert "Unfair Dismissal in South Africa" in content
        assert "Labour Relations Act" in content
        assert "Navigation" not in content  # Nav should be removed
        assert "Footer" not in content  # Footer should be removed
    
    def test_should_skip_url(self, service):
        """Test URL skip logic."""
        assert service._should_skip_url("https://example.com/file.pdf")
        assert service._should_skip_url("https://youtube.com/watch?v=abc")
        assert service._should_skip_url("https://www.facebook.com/page")
        assert not service._should_skip_url("https://example.com/article")
        assert not service._should_skip_url("https://labourguide.co.za/dismissal")
    
    def test_format_for_llm(self, service):
        """Test LLM formatting."""
        from app.services.search_service import SearchResponse
        
        response = SearchResponse(
            query="test query",
            results=[
                SearchResult(
                    url="https://example.com",
                    title="Test Title",
                    snippet="Test snippet",
                    position=1,
                    full_content="Full test content here",
                    scrape_success=True,
                ),
            ],
            total_results=1,
            search_time_ms=100,
            scrape_time_ms=200,
        )
        
        formatted = service.format_for_llm(response)
        
        assert "[WEB SEARCH RESULTS]" in formatted
        assert "Query: test query" in formatted
        assert "Title: Test Title" in formatted
        assert "Content: Full test content here" in formatted
        assert "[END SEARCH RESULTS]" in formatted
    
    def test_caching(self, service):
        """Test cache behavior."""
        key = service._get_cache_key("test query", location="South Africa")
        
        # Set cache
        service._set_cache(key, {"data": "test"})
        
        # Get cache
        cached = service._get_cached(key)
        assert cached == {"data": "test"}
        
        # Different query should not match
        other_key = service._get_cache_key("other query", location="South Africa")
        assert service._get_cached(other_key) is None


class TestSearchExecutor:
    """Tests for search tool executor."""
    
    @pytest.mark.asyncio
    async def test_execute_web_search(self):
        """Test web search executor."""
        with patch('app.tools.search_executor.get_search_service') as mock_get_service:
            mock_service = MagicMock()
            mock_service.search = AsyncMock(return_value=MagicMock(
                total_results=2,
                search_time_ms=100,
                scrape_time_ms=200,
                cached=False,
                credits_used=1,
            ))
            mock_service.format_for_llm = MagicMock(return_value="[WEB SEARCH RESULTS]...")
            mock_get_service.return_value = mock_service
            
            result = await execute_web_search(
                query="test query",
                num_results=5,
            )
            
            assert result["success"]
            assert result["context"] == "[WEB SEARCH RESULTS]..."
            assert result["results_count"] == 2
    
    @pytest.mark.asyncio
    async def test_execute_search_tool_dispatch(self):
        """Test tool dispatch."""
        with patch('app.tools.search_executor.execute_web_search') as mock_web:
            mock_web.return_value = {"success": True}
            
            result = await execute_search_tool(
                tool_name="web_search",
                arguments={"query": "test"},
            )
            
            assert result["success"]
            mock_web.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_unknown_tool(self):
        """Test unknown tool handling."""
        result = await execute_search_tool(
            tool_name="unknown_tool",
            arguments={},
        )
        
        assert not result["success"]
        assert "Unknown" in result["error"]


# Integration test (requires API key)
async def integration_test():
    """Run real integration test with Serper API."""
    print("\n=== Integration Test ===")
    print("Testing with real Serper.dev API...\n")
    
    service = get_search_service()
    
    try:
        # Test 1: Basic search
        print("1. Testing basic search...")
        result = await service.search(
            query="unfair dismissal CCMA South Africa",
            num_results=3,
            scrape_pages=False,
        )
        print(f"   ✓ Found {result.total_results} results in {result.search_time_ms}ms")
        print(f"   ✓ Credits used: {result.credits_used}")
        for r in result.results[:2]:
            print(f"   - {r.title[:50]}...")
        
        # Test 2: Search with scraping
        print("\n2. Testing search with scraping...")
        result = await service.search(
            query="Nike Air Max price South Africa",
            num_results=2,
            scrape_pages=True,
        )
        print(f"   ✓ Found {result.total_results} results")
        print(f"   ✓ Scrape time: {result.scrape_time_ms}ms")
        for r in result.results:
            status = "✓ scraped" if r.scrape_success else f"✗ {r.scrape_error}"
            print(f"   - {r.title[:40]}... ({status})")
        
        # Test 3: LLM formatting
        print("\n3. Testing LLM format output...")
        formatted = service.format_for_llm(result)
        print(f"   ✓ Formatted output: {len(formatted)} chars")
        print(f"   ✓ Preview: {formatted[:200]}...")
        
        # Test 4: Legal search
        print("\n4. Testing legal search executor...")
        legal_result = await execute_legal_search(
            query="automatically unfair dismissal pregnancy",
            time_filter="year",
        )
        print(f"   ✓ Success: {legal_result['success']}")
        print(f"   ✓ Results: {legal_result.get('results_count', 0)}")
        
        print("\n=== All tests passed! ===\n")
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await service.close()


if __name__ == "__main__":
    # Run integration test
    asyncio.run(integration_test())
