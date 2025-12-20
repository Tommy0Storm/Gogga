"""
Google Cloud Storage Service

Handles media storage for Vertex AI outputs (Veo videos, etc.)
Uses europe-west4 region for lowest latency to South Africa.

GCS is required because Vertex AI Veo outputs videos to GCS buckets.
This service:
1. Downloads videos from GCS URIs (gs://bucket/path)
2. Generates signed URLs for browser access
3. Uploads user content for processing
"""

import base64
import logging
from datetime import timedelta
from functools import cached_property
from typing import Any

from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)


class GCSConfig(BaseModel):
    """GCS configuration for GOGGA media storage."""
    
    # Bucket for Veo outputs - must be configured in Vertex AI
    output_bucket: str = "gogga-media-outputs"
    
    # Region closest to SA (Netherlands)
    region: str = "europe-west4"
    
    # Signed URL expiry
    signed_url_expiry_hours: int = 24
    
    # Max file size for downloads (100MB)
    max_download_bytes: int = 100 * 1024 * 1024


class GCSService:
    """
    Google Cloud Storage service for media operations.
    
    Used by Veo service to retrieve generated videos.
    Uses Application Default Credentials (same as Vertex AI).
    """
    
    def __init__(self):
        self._client = None
        self._config = GCSConfig()
    
    @cached_property
    def _storage_client(self):
        """Lazy-load GCS client."""
        try:
            from google.cloud import storage
            return storage.Client(project=settings.GCP_PROJECT_ID)
        except ImportError:
            logger.error("google-cloud-storage not installed. Run: pip install google-cloud-storage")
            return None
        except Exception as e:
            logger.error("Failed to create GCS client: %s", e)
            return None
    
    def parse_gcs_uri(self, gcs_uri: str) -> tuple[str, str] | None:
        """
        Parse GCS URI into bucket and blob path.
        
        Args:
            gcs_uri: URI like gs://bucket-name/path/to/file.mp4
            
        Returns:
            Tuple of (bucket_name, blob_path) or None if invalid
        """
        if not gcs_uri or not gcs_uri.startswith("gs://"):
            return None
        
        # Remove gs:// prefix
        path = gcs_uri[5:]
        
        # Split bucket and blob path
        parts = path.split("/", 1)
        if len(parts) != 2:
            return None
        
        return parts[0], parts[1]
    
    async def download_as_base64(self, gcs_uri: str) -> str | None:
        """
        Download a file from GCS and return as base64.
        
        Args:
            gcs_uri: GCS URI like gs://bucket/path/file.mp4
            
        Returns:
            Base64-encoded file content, or None on error
        """
        if not self._storage_client:
            logger.error("GCS client not available")
            return None
        
        parsed = self.parse_gcs_uri(gcs_uri)
        if not parsed:
            logger.error("Invalid GCS URI: %s", gcs_uri)
            return None
        
        bucket_name, blob_path = parsed
        
        try:
            bucket = self._storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            
            # Check size before downloading
            blob.reload()
            if blob.size and blob.size > self._config.max_download_bytes:
                logger.error("File too large: %d bytes (max %d)", blob.size, self._config.max_download_bytes)
                return None
            
            # Download to memory
            data = blob.download_as_bytes()
            
            # Encode as base64
            return base64.b64encode(data).decode("utf-8")
            
        except Exception as e:
            logger.error("Failed to download from GCS: %s - %s", gcs_uri, e)
            return None
    
    async def generate_signed_url(
        self, 
        gcs_uri: str, 
        expiry_hours: int | None = None
    ) -> str | None:
        """
        Generate a signed URL for browser access to a GCS file.
        
        Args:
            gcs_uri: GCS URI like gs://bucket/path/file.mp4
            expiry_hours: Hours until URL expires (default: 24)
            
        Returns:
            Signed URL accessible without authentication, or None on error
        """
        if not self._storage_client:
            logger.error("GCS client not available")
            return None
        
        parsed = self.parse_gcs_uri(gcs_uri)
        if not parsed:
            logger.error("Invalid GCS URI: %s", gcs_uri)
            return None
        
        bucket_name, blob_path = parsed
        expiry = expiry_hours or self._config.signed_url_expiry_hours
        
        try:
            bucket = self._storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            
            # Generate signed URL
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=expiry),
                method="GET",
            )
            
            logger.info("Generated signed URL for %s (expires in %dh)", gcs_uri, expiry)
            return url
            
        except Exception as e:
            logger.error("Failed to generate signed URL: %s - %s", gcs_uri, e)
            return None
    
    async def upload_from_base64(
        self,
        data: str,
        destination_path: str,
        content_type: str = "application/octet-stream",
    ) -> str | None:
        """
        Upload base64 data to GCS.
        
        Args:
            data: Base64-encoded file content
            destination_path: Path within the output bucket
            content_type: MIME type of the file
            
        Returns:
            GCS URI of uploaded file, or None on error
        """
        if not self._storage_client:
            logger.error("GCS client not available")
            return None
        
        try:
            # Decode base64
            file_bytes = base64.b64decode(data)
            
            bucket = self._storage_client.bucket(self._config.output_bucket)
            blob = bucket.blob(destination_path)
            
            # Upload
            blob.upload_from_string(file_bytes, content_type=content_type)
            
            gcs_uri = f"gs://{self._config.output_bucket}/{destination_path}"
            logger.info("Uploaded to GCS: %s", gcs_uri)
            return gcs_uri
            
        except Exception as e:
            logger.error("Failed to upload to GCS: %s", e)
            return None
    
    async def delete_file(self, gcs_uri: str) -> bool:
        """
        Delete a file from GCS.
        
        Args:
            gcs_uri: GCS URI of file to delete
            
        Returns:
            True if deleted, False on error
        """
        if not self._storage_client:
            return False
        
        parsed = self.parse_gcs_uri(gcs_uri)
        if not parsed:
            return False
        
        bucket_name, blob_path = parsed
        
        try:
            bucket = self._storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            blob.delete()
            logger.info("Deleted from GCS: %s", gcs_uri)
            return True
        except Exception as e:
            logger.error("Failed to delete from GCS: %s - %s", gcs_uri, e)
            return False
    
    def get_output_uri(self, filename: str) -> str:
        """
        Get a GCS URI for Veo output storage.
        
        Args:
            filename: Filename for the output
            
        Returns:
            GCS URI like gs://gogga-media-outputs/veo/filename.mp4
        """
        return f"gs://{self._config.output_bucket}/veo/{filename}"


# Singleton instance
gcs_service = GCSService()
