"""
Admin endpoints for GOGGA backend management.

Provides:
- Cerebras API key rotation stats
- Live usage monitoring
- System health details
- API key management (add/delete)

SECURITY (Dec 2025 Audit):
- All endpoints require admin authentication
- Use X-Admin-Secret header or admin JWT
"""
import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.cerebras_key_rotator import get_key_rotator, reset_rotator
from app.core.security import require_admin


router = APIRouter()


class KeyStats(BaseModel):
    """API key statistics response."""
    name: str
    key_preview: str
    status: str
    requests_remaining: dict | None
    tokens_remaining: dict | None
    limits: dict | None = None
    session_requests: int = 0
    session_429s: int = 0
    is_available: bool = True
    cooldown_remaining: float = 0.0


class KeyRotationStats(BaseModel):
    """Full key rotation statistics."""
    timestamp: float
    total_keys: int
    available_keys: int
    session_total_requests: int
    session_total_429s: int
    keys: list[KeyStats]


class AddKeyRequest(BaseModel):
    """Request to add a new Cerebras API key."""
    api_key: str
    name: str


class DeleteKeyRequest(BaseModel):
    """Request to delete a Cerebras API key."""
    name: str


@router.get("/cerebras/keys", response_model=KeyRotationStats)
async def get_cerebras_key_stats(admin: bool = Depends(require_admin)):
    """
    Get Cerebras API key rotation statistics with live usage data.
    
    Requires admin authentication via X-Admin-Secret header.
    Makes a minimal API call to each key to fetch current rate limits.
    """
    try:
        rotator = get_key_rotator()
        stats = await rotator.get_live_usage()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get key stats: {str(e)}")


@router.get("/cerebras/keys/quick")
async def get_cerebras_key_stats_quick(admin: bool = Depends(require_admin)):
    """
    Get Cerebras API key rotation statistics (cached, no API calls).
    
    Requires admin authentication.
    Returns session-level stats without making API calls.
    """
    try:
        rotator = get_key_rotator()
        return rotator.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get key stats: {str(e)}")


def _get_env_path() -> Path:
    """Get the path to the .env file."""
    # Try to find .env in the backend directory
    backend_dir = Path(__file__).parent.parent.parent.parent.parent
    env_path = backend_dir / ".env"
    if not env_path.exists():
        raise HTTPException(status_code=500, detail=".env file not found")
    return env_path


def _read_cerebras_keys() -> list[tuple[str, str]]:
    """Read current Cerebras keys from .env file."""
    env_path = _get_env_path()
    content = env_path.read_text()
    
    # Find CEREBRAS_API_KEYS line
    match = re.search(r'^CEREBRAS_API_KEYS=(.*)$', content, re.MULTILINE)
    if not match:
        return []
    
    keys_str = match.group(1).strip()
    if not keys_str:
        return []
    
    keys = []
    for entry in keys_str.split(","):
        entry = entry.strip()
        if ":" in entry:
            key, name = entry.split(":", 1)
            keys.append((key.strip(), name.strip()))
        elif entry:
            keys.append((entry, f"key_{len(keys)+1}"))
    
    return keys


def _write_cerebras_keys(keys: list[tuple[str, str]]) -> None:
    """Write Cerebras keys to .env file."""
    env_path = _get_env_path()
    content = env_path.read_text()
    
    # Build new keys string
    keys_str = ",".join(f"{key}:{name}" for key, name in keys)
    new_line = f"CEREBRAS_API_KEYS={keys_str}"
    
    # Replace existing line or add new one
    if re.search(r'^CEREBRAS_API_KEYS=', content, re.MULTILINE):
        content = re.sub(r'^CEREBRAS_API_KEYS=.*$', new_line, content, flags=re.MULTILINE)
    else:
        content += f"\n{new_line}\n"
    
    env_path.write_text(content)
    
    # Update environment variable
    os.environ["CEREBRAS_API_KEYS"] = keys_str
    
    # Reset the rotator to pick up new keys
    reset_rotator()


@router.post("/cerebras/keys")
async def add_cerebras_key(request: AddKeyRequest, _: str = Depends(require_admin)):
    """
    Add a new Cerebras API key.
    
    Updates .env file and reloads the key rotator.
    Requires admin authentication.
    """
    try:
        # Validate key format
        if not request.api_key.startswith("csk-"):
            raise HTTPException(status_code=400, detail="Invalid key format. Must start with 'csk-'")
        
        if not request.name or len(request.name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        
        # Sanitize name (no commas or colons)
        name = request.name.replace(",", "-").replace(":", "-")
        
        # Read current keys
        keys = _read_cerebras_keys()
        
        # Check for duplicates
        for key, existing_name in keys:
            if key == request.api_key:
                raise HTTPException(status_code=400, detail=f"Key already exists with name '{existing_name}'")
            if existing_name.lower() == name.lower():
                raise HTTPException(status_code=400, detail=f"Name '{name}' already in use")
        
        # Add new key
        keys.append((request.api_key, name))
        
        # Write back to .env
        _write_cerebras_keys(keys)
        
        return {
            "success": True,
            "message": f"Added key '{name}'",
            "total_keys": len(keys)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add key: {str(e)}")


@router.delete("/cerebras/keys")
async def delete_cerebras_key(request: DeleteKeyRequest, _: str = Depends(require_admin)):
    """
    Delete a Cerebras API key by name.
    
    Updates .env file and reloads the key rotator.
    Requires admin authentication.
    """
    try:
        if not request.name:
            raise HTTPException(status_code=400, detail="Name is required")
        
        # Read current keys
        keys = _read_cerebras_keys()
        
        # Find and remove key by name
        original_count = len(keys)
        keys = [(k, n) for k, n in keys if n.lower() != request.name.lower()]
        
        if len(keys) == original_count:
            raise HTTPException(status_code=404, detail=f"Key with name '{request.name}' not found")
        
        if len(keys) == 0:
            raise HTTPException(status_code=400, detail="Cannot delete the last API key")
        
        # Write back to .env
        _write_cerebras_keys(keys)
        
        return {
            "success": True,
            "message": f"Deleted key '{request.name}'",
            "total_keys": len(keys)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete key: {str(e)}")
