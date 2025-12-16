"""
GOGGA Prompts API Endpoint

Provides API access to system prompts for admin panel management.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.prompts import (
    PROMPT_METADATA,
    PROMPT_REGISTRY,
    GOGGA_BASE_PROMPT,
    QWEN_IDENTITY_PROMPT,
    get_prompt_for_layer,
)


router = APIRouter(prefix="/prompts", tags=["prompts"])


class PromptInfo(BaseModel):
    """Prompt information response model."""
    key: str
    name: str
    description: str
    model: str
    editable: bool
    prompt_preview: str  # First 200 chars


class PromptDetail(BaseModel):
    """Full prompt detail response model."""
    key: str
    name: str
    description: str
    model: str
    full_prompt: str


class PromptListResponse(BaseModel):
    """Response containing list of all prompts."""
    prompts: list[PromptInfo]
    base_prompts: dict[str, str]


@router.get("/", response_model=PromptListResponse)
async def list_prompts():
    """
    List all available system prompts with metadata.
    Returns prompt previews, not full content.
    """
    prompts = []
    for key, meta in PROMPT_METADATA.items():
        full_prompt = get_prompt_for_layer(key)
        prompts.append(PromptInfo(
            key=key,
            name=meta["name"],
            description=meta["description"],
            model=meta["model"],
            editable=meta["editable"],
            prompt_preview=full_prompt[:200] + "..." if len(full_prompt) > 200 else full_prompt
        ))
    
    return PromptListResponse(
        prompts=prompts,
        base_prompts={
            "gogga_base": GOGGA_BASE_PROMPT[:500] + "...",
            "qwen_identity": QWEN_IDENTITY_PROMPT[:300] + "...",
        }
    )


@router.get("/{prompt_key}", response_model=PromptDetail)
async def get_prompt(prompt_key: str):
    """
    Get full details of a specific prompt.
    """
    if prompt_key not in PROMPT_METADATA:
        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")
    
    meta = PROMPT_METADATA[prompt_key]
    full_prompt = get_prompt_for_layer(prompt_key)
    
    return PromptDetail(
        key=prompt_key,
        name=meta["name"],
        description=meta["description"],
        model=meta["model"],
        full_prompt=full_prompt
    )


@router.get("/base/gogga")
async def get_base_prompt():
    """Get the full GOGGA base prompt."""
    return {"prompt": GOGGA_BASE_PROMPT}


@router.get("/base/qwen")
async def get_qwen_prompt():
    """Get the full Qwen identity prompt."""
    return {"prompt": QWEN_IDENTITY_PROMPT}
