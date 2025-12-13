"""
GOGGA Compression Utilities - Python 3.14

Leverages PEP 784 Zstandard compression for:
- API response compression
- RAG document storage
- Streaming compression
- Embedding vector compression

Python 3.14 Features:
- compression.zstd module for Zstandard support
- Streaming compression/decompression
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Generator, Iterator

logger = logging.getLogger(__name__)

# Python 3.14: Native Zstandard support
try:
    from compression import zstd
    ZSTD_AVAILABLE = True
except ImportError:
    # Fallback - try standalone zstandard package
    try:
        import zstandard as zstd_fallback
        ZSTD_AVAILABLE = True
        
        # Create compatibility layer
        class zstd:
            @staticmethod
            def compress(data: bytes, level: int = 3) -> bytes:
                cctx = zstd_fallback.ZstdCompressor(level=level)
                return cctx.compress(data)
            
            @staticmethod
            def decompress(data: bytes) -> bytes:
                dctx = zstd_fallback.ZstdDecompressor()
                return dctx.decompress(data)
            
            ZstdCompressor = zstd_fallback.ZstdCompressor
            ZstdDecompressor = zstd_fallback.ZstdDecompressor
    except ImportError:
        ZSTD_AVAILABLE = False
        zstd = None  # type: ignore


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class CompressionConfig:
    """Compression configuration."""
    level: int = 3  # Balance between speed and ratio (1-22)
    min_size: int = 1024  # Only compress if larger than this (bytes)
    chunk_size: int = 65536  # Streaming chunk size (64KB)


DEFAULT_CONFIG = CompressionConfig()


# ============================================================================
# Simple Compression
# ============================================================================

def compress(data: bytes, level: int = 3) -> bytes:
    """
    Compress bytes with Zstandard.
    
    Args:
        data: Raw bytes to compress
        level: Compression level (1-22, higher = smaller but slower)
        
    Returns:
        Compressed bytes
    """
    if not ZSTD_AVAILABLE:
        logger.warning("Zstd not available, returning uncompressed")
        return data
    
    return zstd.compress(data, level=level)


def decompress(data: bytes) -> bytes:
    """
    Decompress Zstandard-compressed bytes.
    
    Args:
        data: Compressed bytes
        
    Returns:
        Decompressed bytes
    """
    if not ZSTD_AVAILABLE:
        logger.warning("Zstd not available, returning as-is")
        return data
    
    return zstd.decompress(data)


# ============================================================================
# JSON Compression
# ============================================================================

def compress_json(data: dict[str, Any] | list, level: int = 3) -> bytes:
    """
    Compress JSON data with Zstandard.
    
    Args:
        data: JSON-serializable data
        level: Compression level
        
    Returns:
        Compressed bytes
    """
    json_bytes = json.dumps(data, separators=(',', ':')).encode('utf-8')
    return compress(json_bytes, level)


def decompress_json(data: bytes) -> dict[str, Any] | list:
    """
    Decompress JSON data from Zstandard.
    
    Args:
        data: Compressed bytes
        
    Returns:
        Parsed JSON data
    """
    json_bytes = decompress(data)
    return json.loads(json_bytes.decode('utf-8'))


# ============================================================================
# API Response Compression
# ============================================================================

def compress_response(
    response_data: dict[str, Any],
    config: CompressionConfig = DEFAULT_CONFIG,
) -> tuple[bytes, bool]:
    """
    Compress API response if beneficial.
    
    Args:
        response_data: Response dictionary
        config: Compression configuration
        
    Returns:
        Tuple of (data, was_compressed)
    """
    json_bytes = json.dumps(response_data, separators=(',', ':')).encode('utf-8')
    
    if len(json_bytes) < config.min_size:
        return json_bytes, False
    
    if not ZSTD_AVAILABLE:
        return json_bytes, False
    
    compressed = compress(json_bytes, config.level)
    
    # Only use compression if it actually helps
    if len(compressed) >= len(json_bytes):
        return json_bytes, False
    
    return compressed, True


def decompress_request(
    data: bytes,
    is_compressed: bool = True,
) -> dict[str, Any]:
    """
    Decompress API request body.
    
    Args:
        data: Request body bytes
        is_compressed: Whether data is Zstd-compressed
        
    Returns:
        Parsed JSON data
    """
    if is_compressed and ZSTD_AVAILABLE:
        data = decompress(data)
    
    return json.loads(data.decode('utf-8'))


# ============================================================================
# Streaming Compression
# ============================================================================

class StreamingCompressor:
    """Streaming Zstandard compressor for large data."""
    
    def __init__(self, level: int = 3, chunk_size: int = 65536):
        self.level = level
        self.chunk_size = chunk_size
        self._compressor = None
        
        if ZSTD_AVAILABLE:
            self._compressor = zstd.ZstdCompressor(level=level)
    
    def compress_stream(
        self,
        data_iterator: Iterator[bytes],
    ) -> Generator[bytes, None, None]:
        """
        Compress streaming data.
        
        Args:
            data_iterator: Iterator of data chunks
            
        Yields:
            Compressed chunks
        """
        if not ZSTD_AVAILABLE or self._compressor is None:
            # Fallback: yield uncompressed
            yield from data_iterator
            return
        
        # Use streaming compression
        output = BytesIO()
        
        with self._compressor.stream_writer(output, closefd=False) as writer:
            for chunk in data_iterator:
                writer.write(chunk)
                # Flush periodically
                if output.tell() >= self.chunk_size:
                    yield output.getvalue()
                    output.seek(0)
                    output.truncate()
        
        # Yield remaining data
        remaining = output.getvalue()
        if remaining:
            yield remaining
    
    def compress_all(self, data: bytes) -> bytes:
        """Compress all data at once."""
        return compress(data, self.level)


class StreamingDecompressor:
    """Streaming Zstandard decompressor for large data."""
    
    def __init__(self, chunk_size: int = 65536):
        self.chunk_size = chunk_size
        self._decompressor = None
        
        if ZSTD_AVAILABLE:
            self._decompressor = zstd.ZstdDecompressor()
    
    def decompress_stream(
        self,
        data_iterator: Iterator[bytes],
    ) -> Generator[bytes, None, None]:
        """
        Decompress streaming data.
        
        Args:
            data_iterator: Iterator of compressed chunks
            
        Yields:
            Decompressed chunks
        """
        if not ZSTD_AVAILABLE or self._decompressor is None:
            yield from data_iterator
            return
        
        # Collect all compressed data first (zstd needs complete frames)
        compressed = b''.join(data_iterator)
        decompressed = decompress(compressed)
        
        # Yield in chunks
        for i in range(0, len(decompressed), self.chunk_size):
            yield decompressed[i:i + self.chunk_size]


# ============================================================================
# Embedding Vector Compression
# ============================================================================

def compress_embeddings(
    embeddings: list[list[float]],
    level: int = 5,  # Higher level for embeddings (more compressible)
) -> bytes:
    """
    Compress embedding vectors.
    
    Embeddings are highly compressible due to patterns.
    Uses higher compression level for better ratio.
    
    Args:
        embeddings: List of embedding vectors
        level: Compression level
        
    Returns:
        Compressed bytes
    """
    # Pack as JSON (float arrays compress well)
    json_data = json.dumps(embeddings, separators=(',', ':'))
    return compress(json_data.encode('utf-8'), level)


def decompress_embeddings(data: bytes) -> list[list[float]]:
    """
    Decompress embedding vectors.
    
    Args:
        data: Compressed bytes
        
    Returns:
        List of embedding vectors
    """
    json_data = decompress(data).decode('utf-8')
    return json.loads(json_data)


# ============================================================================
# RAG Document Compression
# ============================================================================

@dataclass
class CompressedDocument:
    """Compressed document with metadata."""
    original_size: int
    compressed_size: int
    compression_ratio: float
    data: bytes
    
    @property
    def saved_bytes(self) -> int:
        return self.original_size - self.compressed_size
    
    @property
    def saved_percent(self) -> float:
        if self.original_size == 0:
            return 0.0
        return (self.saved_bytes / self.original_size) * 100


def compress_document(
    content: str,
    level: int = 5,
) -> CompressedDocument:
    """
    Compress document content.
    
    Args:
        content: Document text content
        level: Compression level
        
    Returns:
        CompressedDocument with metadata
    """
    original_bytes = content.encode('utf-8')
    original_size = len(original_bytes)
    
    compressed = compress(original_bytes, level)
    compressed_size = len(compressed)
    
    ratio = compressed_size / original_size if original_size > 0 else 1.0
    
    return CompressedDocument(
        original_size=original_size,
        compressed_size=compressed_size,
        compression_ratio=ratio,
        data=compressed,
    )


def decompress_document(doc: CompressedDocument) -> str:
    """
    Decompress document content.
    
    Args:
        doc: CompressedDocument
        
    Returns:
        Original document text
    """
    return decompress(doc.data).decode('utf-8')


# ============================================================================
# FastAPI Middleware Integration
# ============================================================================

async def zstd_compress_response(
    body: bytes,
    min_size: int = 1024,
    level: int = 3,
) -> tuple[bytes, dict[str, str]]:
    """
    Compress response body for FastAPI middleware.
    
    Args:
        body: Response body bytes
        min_size: Minimum size to compress
        level: Compression level
        
    Returns:
        Tuple of (body, headers)
    """
    headers: dict[str, str] = {}
    
    if len(body) < min_size or not ZSTD_AVAILABLE:
        return body, headers
    
    compressed = compress(body, level)
    
    if len(compressed) < len(body):
        headers['Content-Encoding'] = 'zstd'
        headers['X-Original-Size'] = str(len(body))
        return compressed, headers
    
    return body, headers


# ============================================================================
# Availability Check
# ============================================================================

def is_zstd_available() -> bool:
    """Check if Zstandard compression is available."""
    return ZSTD_AVAILABLE


def get_compression_info() -> dict[str, Any]:
    """Get compression library information."""
    info = {
        "available": ZSTD_AVAILABLE,
        "library": "unknown",
    }
    
    if ZSTD_AVAILABLE:
        try:
            # Python 3.14 native
            from compression import zstd as native_zstd
            info["library"] = "compression.zstd (Python 3.14)"
        except ImportError:
            info["library"] = "zstandard (fallback)"
    
    return info
