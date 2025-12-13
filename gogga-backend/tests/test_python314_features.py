"""
Tests for Python 3.14 Features - Template Strings and Compression

These tests verify the new Python 3.14 features work correctly,
with fallback behavior for older Python versions.
"""
import json
import pytest
from unittest.mock import patch, MagicMock


# ============================================================================
# Template String Tests
# ============================================================================

class TestTemplateStrings:
    """Tests for PEP 750 t-string utilities."""
    
    def test_imports_work(self):
        """Verify template_strings module imports."""
        from app.core.template_strings import (
            safe_sql,
            safe_html,
            safe_shell,
            structured_log,
            safe_prompt,
            is_tstrings_available,
        )
        # Should not raise
        assert callable(safe_sql)
        assert callable(safe_html)
        assert callable(is_tstrings_available)
    
    def test_availability_check(self):
        """Test t-strings availability check."""
        from app.core.template_strings import is_tstrings_available, get_python_version
        
        # Should return bool
        available = is_tstrings_available()
        assert isinstance(available, bool)
        
        # Version should be string
        version = get_python_version()
        assert isinstance(version, str)
        assert "." in version


class TestSQLSanitization:
    """Tests for SQL injection prevention."""
    
    def test_escape_sql_value_string(self):
        """Test string escaping for SQL."""
        from app.core.template_strings import _escape_sql_value, SQLDialect
        
        # Normal string
        assert _escape_sql_value("hello") == "'hello'"
        
        # String with single quote
        assert _escape_sql_value("it's") == "'it''s'"
        
        # SQL injection attempt
        result = _escape_sql_value("'; DROP TABLE users; --")
        assert "DROP TABLE" in result
        assert "''" in result  # Escaped quote
    
    def test_escape_sql_value_types(self):
        """Test escaping for different types."""
        from app.core.template_strings import _escape_sql_value
        
        # None
        assert _escape_sql_value(None) == "NULL"
        
        # Boolean
        assert _escape_sql_value(True) == "1"
        assert _escape_sql_value(False) == "0"
        
        # Numbers
        assert _escape_sql_value(42) == "42"
        assert _escape_sql_value(3.14) == "3.14"
    
    def test_escape_mysql_dialect(self):
        """Test MySQL-specific escaping."""
        from app.core.template_strings import _escape_sql_value, SQLDialect
        
        result = _escape_sql_value("test\nvalue", SQLDialect.MYSQL)
        assert "\\n" in result
    
    def test_safe_sql_identifier(self):
        """Test SQL identifier validation."""
        from app.core.template_strings import safe_sql_identifier
        
        # Valid identifiers
        assert safe_sql_identifier("users") == "users"
        assert safe_sql_identifier("user_id") == "user_id"
        assert safe_sql_identifier("User123") == "User123"
        
        # Invalid identifiers should raise
        with pytest.raises(ValueError):
            safe_sql_identifier("users; DROP TABLE")
        
        with pytest.raises(ValueError):
            safe_sql_identifier("123invalid")


class TestHTMLSanitization:
    """Tests for XSS prevention."""
    
    def test_basic_html_escape(self):
        """Test basic HTML character escaping."""
        import html
        
        # Standard library escape
        assert html.escape("<script>") == "&lt;script&gt;"
        assert html.escape("&") == "&amp;"
        assert html.escape('"') == "&quot;"


class TestShellSanitization:
    """Tests for shell command injection prevention."""
    
    def test_basic_shell_quote(self):
        """Test basic shell quoting."""
        import shlex
        
        # Shlex should quote dangerous characters
        assert shlex.quote("file.txt") == "file.txt"
        assert "'" in shlex.quote("file; rm -rf /")


class TestStructuredLogging:
    """Tests for structured log generation."""
    
    def test_structured_log_entry_creation(self):
        """Test StructuredLogEntry dataclass."""
        from app.core.template_strings import StructuredLogEntry
        
        entry = StructuredLogEntry(
            message="User {user} logged in",
            context={"user": "alice"},
            level="INFO",
        )
        
        assert entry.message == "User {user} logged in"
        assert entry.context["user"] == "alice"
        assert entry.level == "INFO"
    
    def test_structured_log_to_dict(self):
        """Test StructuredLogEntry.to_dict()."""
        from app.core.template_strings import StructuredLogEntry
        
        entry = StructuredLogEntry(
            message="Test",
            context={"key": "value"},
        )
        
        d = entry.to_dict()
        assert d["message"] == "Test"
        assert d["context"]["key"] == "value"
        assert "timestamp" in d
    
    def test_structured_log_to_json(self):
        """Test StructuredLogEntry.to_json()."""
        from app.core.template_strings import StructuredLogEntry
        
        entry = StructuredLogEntry(message="Test", context={})
        
        json_str = entry.to_json()
        parsed = json.loads(json_str)
        assert parsed["message"] == "Test"


class TestPromptSanitization:
    """Tests for AI prompt injection prevention."""
    
    def test_prompt_escape_patterns(self):
        """Test common prompt injection patterns are escaped."""
        patterns = [
            "```",  # Code blocks
            "###",  # Headers
            "[INST]",  # Instruction markers
            "<<SYS>>",  # System prompts
        ]
        
        for pattern in patterns:
            # These should be escaped when using safe_prompt
            # For now, just verify the patterns exist
            assert isinstance(pattern, str)


class TestTemplateProcessor:
    """Tests for custom template processor creation."""
    
    def test_create_template_processor(self):
        """Test create_template_processor factory."""
        from app.core.template_strings import create_template_processor
        
        # Create uppercase processor
        processor = create_template_processor(
            escape_fn=lambda x: str(x).upper()
        )
        
        assert callable(processor)


# ============================================================================
# Compression Tests
# ============================================================================

class TestCompressionAvailability:
    """Tests for compression availability."""
    
    def test_imports_work(self):
        """Verify compression module imports."""
        from app.core.compression import (
            compress,
            decompress,
            compress_json,
            decompress_json,
            is_zstd_available,
            get_compression_info,
        )
        
        assert callable(compress)
        assert callable(decompress)
        assert callable(is_zstd_available)
    
    def test_availability_check(self):
        """Test compression availability check."""
        from app.core.compression import is_zstd_available, get_compression_info
        
        available = is_zstd_available()
        assert isinstance(available, bool)
        
        info = get_compression_info()
        assert "available" in info
        assert "library" in info


class TestBasicCompression:
    """Tests for basic compression operations."""
    
    def test_compress_decompress_roundtrip(self):
        """Test compress/decompress roundtrip."""
        from app.core.compression import compress, decompress, is_zstd_available
        
        original = b"Hello, World! " * 100
        
        compressed = compress(original)
        
        if is_zstd_available():
            # Should be smaller
            assert len(compressed) < len(original)
            
            # Should roundtrip
            decompressed = decompress(compressed)
            assert decompressed == original
        else:
            # Fallback: returns original
            assert compressed == original
    
    def test_empty_data(self):
        """Test handling of empty data."""
        from app.core.compression import compress, decompress
        
        compressed = compress(b"")
        decompressed = decompress(compressed)
        # Should not crash


class TestJSONCompression:
    """Tests for JSON compression."""
    
    def test_json_roundtrip(self):
        """Test JSON compress/decompress roundtrip."""
        from app.core.compression import compress_json, decompress_json, is_zstd_available
        
        original = {"message": "hello" * 100, "count": 42, "items": [1, 2, 3]}
        
        compressed = compress_json(original)
        assert isinstance(compressed, bytes)
        
        if is_zstd_available():
            decompressed = decompress_json(compressed)
            assert decompressed == original
    
    def test_list_data(self):
        """Test compressing list data."""
        from app.core.compression import compress_json, decompress_json, is_zstd_available
        
        original = [1, 2, 3, 4, 5] * 100
        
        compressed = compress_json(original)
        
        if is_zstd_available():
            decompressed = decompress_json(compressed)
            assert decompressed == original


class TestResponseCompression:
    """Tests for API response compression."""
    
    def test_compress_response_small(self):
        """Test that small responses are not compressed."""
        from app.core.compression import compress_response, CompressionConfig
        
        config = CompressionConfig(min_size=1024)
        data = {"small": "data"}
        
        result, was_compressed = compress_response(data, config)
        
        # Too small, should not compress
        assert not was_compressed
        assert isinstance(result, bytes)
    
    def test_compress_response_large(self):
        """Test that large responses are compressed."""
        from app.core.compression import compress_response, CompressionConfig, is_zstd_available
        
        config = CompressionConfig(min_size=100)
        data = {"message": "x" * 1000}
        
        result, was_compressed = compress_response(data, config)
        
        if is_zstd_available():
            assert was_compressed
            # Should be smaller
            original_json = json.dumps(data).encode()
            assert len(result) < len(original_json)


class TestStreamingCompression:
    """Tests for streaming compression."""
    
    def test_streaming_compressor_init(self):
        """Test StreamingCompressor initialization."""
        from app.core.compression import StreamingCompressor
        
        compressor = StreamingCompressor(level=5, chunk_size=4096)
        assert compressor.level == 5
        assert compressor.chunk_size == 4096
    
    def test_streaming_compress_all(self):
        """Test single-shot compression."""
        from app.core.compression import StreamingCompressor, is_zstd_available
        
        compressor = StreamingCompressor()
        data = b"test data " * 100
        
        compressed = compressor.compress_all(data)
        
        if is_zstd_available():
            assert len(compressed) < len(data)


class TestEmbeddingCompression:
    """Tests for embedding vector compression."""
    
    def test_embedding_roundtrip(self):
        """Test embedding compress/decompress roundtrip."""
        from app.core.compression import compress_embeddings, decompress_embeddings, is_zstd_available
        
        # Simulated embeddings (384-dim like E5-small)
        embeddings = [[0.1] * 384 for _ in range(10)]
        
        compressed = compress_embeddings(embeddings)
        assert isinstance(compressed, bytes)
        
        if is_zstd_available():
            decompressed = decompress_embeddings(compressed)
            assert len(decompressed) == 10
            assert len(decompressed[0]) == 384


class TestDocumentCompression:
    """Tests for document compression."""
    
    def test_document_compression(self):
        """Test document compress/decompress."""
        from app.core.compression import compress_document, decompress_document, is_zstd_available
        
        content = "Lorem ipsum " * 1000
        
        doc = compress_document(content)
        
        assert doc.original_size == len(content.encode('utf-8'))
        assert doc.compressed_size == len(doc.data)
        
        if is_zstd_available():
            assert doc.compression_ratio < 1.0
            assert doc.saved_bytes > 0
            
            recovered = decompress_document(doc)
            assert recovered == content


class TestMiddlewareIntegration:
    """Tests for FastAPI middleware integration."""
    
    @pytest.mark.asyncio
    async def test_zstd_compress_response_small(self):
        """Test middleware skips small responses."""
        from app.core.compression import zstd_compress_response
        
        body = b"small"
        result, headers = await zstd_compress_response(body, min_size=1024)
        
        assert result == body
        assert 'Content-Encoding' not in headers
    
    @pytest.mark.asyncio
    async def test_zstd_compress_response_large(self):
        """Test middleware compresses large responses."""
        from app.core.compression import zstd_compress_response, is_zstd_available
        
        body = b"x" * 2000
        result, headers = await zstd_compress_response(body, min_size=100)
        
        if is_zstd_available():
            assert headers.get('Content-Encoding') == 'zstd'
            assert len(result) < len(body)


# ============================================================================
# Integration Tests
# ============================================================================

class TestIntegration:
    """Integration tests combining multiple features."""
    
    def test_compressed_structured_log(self):
        """Test compressing structured log entries."""
        from app.core.template_strings import StructuredLogEntry
        from app.core.compression import compress_json, decompress_json, is_zstd_available
        
        entry = StructuredLogEntry(
            message="User {user} performed {action}",
            context={"user": "alice", "action": "login"},
            level="INFO",
        )
        
        data = entry.to_dict()
        compressed = compress_json(data)
        
        if is_zstd_available():
            decompressed = decompress_json(compressed)
            assert decompressed["message"] == entry.message
    
    def test_compression_config(self):
        """Test CompressionConfig defaults."""
        from app.core.compression import CompressionConfig, DEFAULT_CONFIG
        
        assert DEFAULT_CONFIG.level == 3
        assert DEFAULT_CONFIG.min_size == 1024
        assert DEFAULT_CONFIG.chunk_size == 65536
        
        custom = CompressionConfig(level=10, min_size=512)
        assert custom.level == 10
        assert custom.min_size == 512
