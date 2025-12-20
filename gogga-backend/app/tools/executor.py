"""
GOGGA Tool Execution Service

Handles backend execution of tools that require server-side processing.
Frontend-only tools (memory, charts) are handled by the frontend.
"""

import asyncio
import os
import time
import urllib.parse
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


# =============================================================================
# Math Delegation - 235B delegates to 32B for computation
# =============================================================================

MATH_DELEGATION_PROMPT = """You are a precise mathematical computation assistant. Your ONLY job is to:
1. Read the math task given to you
2. Write SymPy Python code to compute it
3. Execute the code using the python_execute tool
4. Return the computed result

Available in python_execute:
- SymPy: Symbol, symbols, solve, diff, integrate, limit, series, Matrix, det, Eq, simplify, expand, factor, dsolve, latex
- NumPy: np (numpy)
- Math constants: pi, E, I (imaginary), oo (infinity)
- Trig: sin, cos, tan, exp, log, sqrt

IMPORTANT: 
- Always print results clearly with labels
- Include LaTeX output when relevant: print(f"LaTeX: {latex(result)}")
- For matrices, show step by step
- Be precise and thorough

Task to compute:
"""


async def _execute_math_delegation(task: str, context: str = "") -> dict[str, Any]:
    """
    Execute math delegation by calling 32B model to write and run SymPy code.
    
    This creates an internal chat request to the 32B model with the python_execute
    tool, executes the tool, and returns the result.
    """
    import asyncio
    import json
    from app.services.ai_service import get_client
    from app.services.python_executor import get_python_executor
    from app.tools.math_definitions import PYTHON_EXECUTOR_TOOL
    from app.config import settings
    
    try:
        # Build the prompt for 32B
        full_prompt = MATH_DELEGATION_PROMPT + task
        if context:
            full_prompt += f"\n\nContext: {context}"
        
        logger.info(f"🧮 MATH DELEGATE: Calling 32B model for computation")
        
        # Get Cerebras client and call 32B with python_execute tool
        client = get_client()
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=settings.MODEL_JIVE,  # 32B thinking model
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise math computation assistant. Use the python_execute tool to compute results."
                },
                {"role": "user", "content": full_prompt}
            ],
            tools=[PYTHON_EXECUTOR_TOOL],
            temperature=0.6,  # Qwen requires non-zero temp
            max_tokens=4000,
        )
        
        # Extract the choice from OpenAI-compatible response
        choice = response.choices[0].message
        
        # Check if model returned tool calls
        if hasattr(choice, 'tool_calls') and choice.tool_calls:
            tool_call = choice.tool_calls[0]
            if tool_call.function.name == "python_execute":
                # Parse the arguments
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                code = args.get("code", "")
                description = args.get("description", "Math computation")
                
                logger.info(f"🧮 MATH DELEGATE: Executing SymPy code: {code[:100]}...")
                
                executor = get_python_executor()
                result = executor.execute(
                    code=code,
                    description=description,
                    timeout=30  # Longer timeout for complex math
                )
                
                return {
                    "success": result.success,
                    "result": result.output,
                    "output": result.output,
                    "error": result.error,
                    "execution_time_ms": result.execution_time_ms,
                    "display_type": "math_delegate",
                    "type": "math_delegate",
                    "delegated_to": "qwen-3-32b",
                    "code_executed": code,
                    "task": task,
                    "calculation_steps": [
                        f"Task: {task}",
                        f"Delegated to: Qwen 32B + SymPy",
                        f"Code executed: {len(code)} chars",
                        f"Result: {result.output[:200]}..." if len(result.output) > 200 else f"Result: {result.output}",
                    ]
                }
        
        # If no tool call, model might have answered directly
        content = choice.content or ""
        if content:
            return {
                "success": True,
                "result": content,
                "output": content,
                "display_type": "math_delegate",
                "type": "math_delegate",
                "delegated_to": "qwen-3-32b",
                "task": task,
                "note": "Model answered directly without code execution"
            }
        
        return {
            "success": False,
            "error": "32B model did not return a computation",
            "display_type": "alert_cards"
        }
        
    except Exception as e:
        logger.error(f"Math delegation error: {e}")
        return {
            "success": False,
            "error": f"Math delegation failed: {str(e)}",
            "display_type": "alert_cards"
        }


# =============================================================================
# Image Generation - Pollinations.ai + AI Horde (Dual Free Generators)
# =============================================================================

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"

# AI Horde settings
AI_HORDE_API_URL = "https://aihorde.net/api/v2"
AI_HORDE_API_KEY = os.getenv("AI_HORDE_API_KEY", "0000000000")
AI_HORDE_TIMEOUT = 25.0  # Reasonable timeout for registered users
AI_HORDE_POLL_INTERVAL = 1.0  # Poll every 1s for faster response detection


async def _generate_horde_image(prompt: str) -> str | None:
    """
    Generate image via AI Horde (community-powered, free).
    Returns image URL on success, None on failure (silently handles errors).
    Includes retry logic for 429 rate limits.
    """
    max_retries = 2  # Reduced from 3 to be faster
    
    # Create client once outside retry loop for efficiency
    timeout = httpx.Timeout(10.0, connect=5.0)  # 5s connect, 10s total per request
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                headers={
                    "Content-Type": "application/json",
                    "apikey": AI_HORDE_API_KEY,
                    "Client-Agent": "Gogga:1.0:gogga@southafrica.ai",
                }
            ) as client:
                # Submit async generation request with HD quality settings
                # Negative prompt for best quality output
                negative_prompt = "lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, blurry, bad anatomy, watermark, signature"
                
                generate_payload = {
                    "prompt": prompt,
                    "params": {
                        "cfg_scale": 7.0,
                        "sampler_name": "k_euler",  # Good quality sampler
                        "height": 512,
                        "width": 512,
                        "steps": 15,  # Reduced for speed (still good quality)
                        "karras": True,
                        "n": 1
                    },
                    "nsfw": False,
                    "censor_nsfw": False,  # Disable overly aggressive filter (GOGGA has own moderation)
                    "trusted_workers": False,  # Allow all workers for faster processing
                    "models": ["Deliberate", "stable_diffusion"],  # Fast popular models
                    "r2": True,
                    "shared": False,
                    "slow_workers": False,  # Only fast workers for speed
                    "replacement_filter": True  # Filter bad quality outputs
                }
                
                logger.debug("AI Horde: Submitting request (attempt %d)", attempt + 1)
                response = await client.post(
                    f"{AI_HORDE_API_URL}/generate/async",
                    json=generate_payload
                )
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    retry_after = int(response.headers.get("Retry-After", 3))
                    logger.debug("AI Horde rate limited, retrying in %ds (attempt %d/%d)", retry_after, attempt + 1, max_retries)
                    await asyncio.sleep(retry_after)
                    continue
                
                if response.status_code != 202:
                    logger.debug("AI Horde submit failed (%s): %s", response.status_code, response.text)
                    return None
                
                result = response.json()
                request_id = result.get("id")
                if not request_id:
                    return None
                
                logger.debug("AI Horde request submitted: %s", request_id)
                
                # Poll for completion
                start = time.monotonic()
                while time.monotonic() - start < AI_HORDE_TIMEOUT:
                    check_response = await client.get(
                        f"{AI_HORDE_API_URL}/generate/check/{request_id}"
                    )
                    
                    if check_response.status_code != 200:
                        await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                        continue
                    
                    check_data = check_response.json()
                    if check_data.get("finished", 0) >= 1:
                        break
                    if check_data.get("faulted"):
                        logger.debug("AI Horde generation faulted")
                        return None
                        
                    await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                else:
                    # Timeout - cancel request silently
                    logger.debug("AI Horde timeout, cancelling")
                    await client.delete(f"{AI_HORDE_API_URL}/generate/status/{request_id}")
                    return None
                
                # Get completed image
                status_response = await client.get(
                    f"{AI_HORDE_API_URL}/generate/status/{request_id}"
                )
                
                if status_response.status_code != 200:
                    return None
                
                status_data = status_response.json()
                generations = status_data.get("generations", [])
                
                if generations and generations[0].get("img"):
                    logger.info("AI Horde image generated successfully")
                    return generations[0]["img"]
                
                return None
                
        except Exception as e:
            logger.debug("AI Horde error (silent): %s", e)
            if attempt < max_retries - 1:
                await asyncio.sleep(2)  # Brief pause before retry
                continue
            return None
    
    return None


# HD Quality enhancement keywords (for FREE tier Pollinations)
HD_QUALITY_SUFFIX = ", masterpiece, best quality, hyperdetailed, highly detailed, sharp focus, HD, 4K, ultra high resolution"


async def _generate_imagen_image(prompt: str, style: str | None = None) -> dict[str, Any]:
    """
    Generate image using Vertex AI Imagen 3.0 (for JIVE/JIGGA tiers).
    
    Returns dict with success status and image data (base64).
    """
    from app.services.imagen_service import (
        ImagenService, ImagenRequest, ImagenOperation
    )
    
    try:
        imagen = ImagenService()
        request = ImagenRequest(
            prompt=prompt,
            operation=ImagenOperation.CREATE,
            aspect_ratio="1:1",  # Square by default
            sample_count=1,
        )
        
        response = await imagen.generate(request=request, user_id=None)
        
        if response.success and response.images:
            # Convert base64 to data URL for display
            image_data = response.images[0]
            data_url = f"data:image/png;base64,{image_data}"
            return {
                "success": True,
                "image_url": data_url,
                "image_urls": [data_url],
                "prompt": prompt,
                "style": style,
                "providers": ["vertex-ai-imagen-3.0"],
                "image_count": 1,
                "model": "imagen-3.0-generate-002",
                "note": "Generated with Vertex AI Imagen 3.0 (premium quality)"
            }
        else:
            return {
                "success": False,
                "error": response.error or "Imagen generation failed",
            }
    except Exception as e:
        logger.error(f"Imagen generation error: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def execute_generate_image(
    prompt: str,
    style: str | None = None,
    tier: str = "free"
) -> dict[str, Any]:
    """
    Generate images with tier-based provider routing:
    
    - FREE: Pollinations.ai + AI Horde (dual free generators)
    - JIVE/JIGGA: Vertex AI Imagen 3.0 (premium quality)
    
    Args:
        prompt: Text description of the image to generate
        style: Optional style hint (photorealistic, artistic, etc.)
        tier: User tier (free, jive, jigga)
    
    Returns:
        dict with image_urls (array) and metadata
    """
    tier_lower = tier.lower() if tier else "free"
    
    # JIVE/JIGGA: Use premium Imagen 3.0
    if tier_lower in ("jive", "jigga"):
        logger.info(f"🖼️ Imagen 3.0: Generating for {tier_lower.upper()} tier")
        result = await _generate_imagen_image(prompt, style)
        
        # If Imagen succeeds, return it
        if result.get("success"):
            return result
        
        # Fallback to Pollinations if Imagen fails
        logger.warning(f"Imagen failed, falling back to Pollinations: {result.get('error')}")
    
    # FREE tier (or fallback): Use Pollinations + AI Horde
    logger.info(f"🖼️ Pollinations: Generating for {tier_lower.upper()} tier")
    
    # Enhance prompt with style if provided
    full_prompt = prompt
    if style:
        style_hints = {
            "photorealistic": "photorealistic, highly detailed, 8k resolution, professional photography",
            "artistic": "artistic, painterly, expressive brushstrokes, fine art",
            "cartoon": "cartoon style, colorful, animated, vibrant",
            "sketch": "pencil sketch, hand-drawn, detailed linework",
            "3d-render": "3D render, CGI, volumetric lighting, octane render",
        }
        if style in style_hints:
            full_prompt = f"{prompt}, {style_hints[style]}"
    
    # Add HD quality suffix for maximum quality
    full_prompt = f"{full_prompt}{HD_QUALITY_SUFFIX}"
    
    # URL encode for Pollinations - optimized for speed
    encoded_prompt = urllib.parse.quote(full_prompt)
    # Speed optimized: no enhance (prompt already enhanced), smaller size for faster generation
    # nologo=true removes watermark, model=turbo for best speed (uses default Stable Diffusion)
    pollinations_url = f"{POLLINATIONS_BASE_URL}/{encoded_prompt}?nologo=true&width=1024&height=1024&model=turbo"
    
    # Fire both generators in parallel
    horde_task = asyncio.create_task(_generate_horde_image(full_prompt))
    
    # Collect all successful image URLs
    image_urls = [pollinations_url]  # Pollinations always "succeeds" (URL-based)
    
    # Wait for Horde (with extra buffer for task overhead)
    try:
        horde_url = await asyncio.wait_for(horde_task, timeout=AI_HORDE_TIMEOUT + 5)
        if horde_url:
            image_urls.append(horde_url)
            logger.info("Tool calling: Both Pollinations and AI Horde succeeded")
        else:
            logger.debug("Tool calling: AI Horde returned None (Pollinations only)")
    except asyncio.TimeoutError:
        logger.debug("Tool calling: AI Horde timed out (Pollinations only)")
    except Exception as e:
        logger.debug("Tool calling: AI Horde error (silent): %s", e)
    
    logger.info(f"Generated {len(image_urls)} image(s) for prompt: {prompt[:50]}...")
    
    return {
        "success": True,
        "image_url": image_urls[0],  # Primary (Pollinations)
        "image_urls": image_urls,  # All successful images
        "prompt": prompt,
        "style": style,
        "providers": ["pollinations"] + (["ai-horde"] if len(image_urls) > 1 else []),
        "image_count": len(image_urls),
        "note": "Image(s) generated from dual free providers"
    }


# =============================================================================
# Premium Image Tools - Imagen 4.0 Upscale, Imagen 3.0 Edit
# =============================================================================

async def execute_upscale_image(
    source_image_id: str,
    upscale_factor: str = "x2",
    tier: str = "free"
) -> dict[str, Any]:
    """
    Upscale an image using Imagen 4 Ultra.
    
    JIVE/JIGGA tier required. Uses Imagen 4.0 upscale model for
    premium quality upscaling.
    
    Args:
        source_image_id: ID of the image to upscale (from previous generation)
        upscale_factor: Upscale factor (x2, x3, x4)
        tier: User tier (must be jive or jigga)
    
    Returns:
        dict with upscaled image data and metadata
    """
    tier_lower = tier.lower() if tier else "free"
    
    # Tier check - premium feature only
    if tier_lower not in ("jive", "jigga"):
        return {
            "success": False,
            "error": "Upscale image requires JIVE or JIGGA tier. Please upgrade to access Imagen 4 Ultra upscaling.",
            "upgrade_required": True,
        }
    
    # Validate upscale factor
    if upscale_factor not in ("x2", "x3", "x4"):
        return {
            "success": False,
            "error": f"Invalid upscale factor: {upscale_factor}. Must be x2, x3, or x4.",
        }
    
    logger.info(f"🔍 Imagen 4 Upscale: {upscale_factor} for {tier_lower.upper()} tier, image_id={source_image_id[:20]}...")
    
    try:
        from app.services.imagen_service import ImagenService, ImagenRequest, ImagenOperation
        from app.core.router import UserTier
        
        # Initialize Imagen service
        imagen = ImagenService()
        
        # The source_image_id should be base64 encoded image data or we need to fetch it
        # For now, return instructions for frontend to handle
        return {
            "success": True,
            "action": "upscale",
            "requires_image_data": True,
            "source_image_id": source_image_id,
            "upscale_factor": upscale_factor,
            "message": f"Ready to upscale image {upscale_factor}. Please provide the image data.",
            "tier": tier_lower,
            "model": "imagen-4.0-upscale-preview",
            "execute_on": "frontend_with_image",  # Frontend needs to pass image data
        }
        
    except Exception as e:
        logger.exception(f"Upscale execution failed: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def execute_edit_image(
    source_image_id: str,
    edit_prompt: str,
    edit_mode: str = "INPAINT_INSERTION",
    mask_description: str | None = None,
    tier: str = "free"
) -> dict[str, Any]:
    """
    Edit an image using Imagen 3.0 mask-based editing.
    
    JIVE/JIGGA tier required. Supports inpainting, outpainting,
    background swap, and object removal.
    
    Args:
        source_image_id: ID of the image to edit
        edit_prompt: Description of the edit to make
        edit_mode: Edit mode (INPAINT_INSERTION, INPAINT_REMOVAL, BGSWAP, OUTPAINT)
        mask_description: Optional natural language mask description
        tier: User tier (must be jive or jigga)
    
    Returns:
        dict with edited image data and metadata
    """
    tier_lower = tier.lower() if tier else "free"
    
    # Tier check - premium feature only
    if tier_lower not in ("jive", "jigga"):
        return {
            "success": False,
            "error": "Edit image requires JIVE or JIGGA tier. Please upgrade to access Imagen 3.0 editing.",
            "upgrade_required": True,
        }
    
    # Validate edit mode
    valid_modes = ("INPAINT_INSERTION", "INPAINT_REMOVAL", "BGSWAP", "OUTPAINT")
    if edit_mode not in valid_modes:
        return {
            "success": False,
            "error": f"Invalid edit mode: {edit_mode}. Must be one of: {', '.join(valid_modes)}",
        }
    
    logger.info(f"✏️ Imagen 3 Edit: {edit_mode} for {tier_lower.upper()} tier, prompt={edit_prompt[:50]}...")
    
    try:
        # Return instructions for frontend to handle mask drawing
        return {
            "success": True,
            "action": "edit",
            "requires_mask": edit_mode != "BGSWAP",  # BGSWAP auto-detects background
            "source_image_id": source_image_id,
            "edit_prompt": edit_prompt,
            "edit_mode": edit_mode,
            "mask_description": mask_description,
            "message": f"Ready to edit image. {'Please draw a mask on the area to edit.' if edit_mode != 'BGSWAP' else 'Background will be automatically detected.'}",
            "tier": tier_lower,
            "model": "imagen-3.0-capability-001",
            "execute_on": "frontend_with_mask",  # Frontend needs to provide mask
        }
        
    except Exception as e:
        logger.exception(f"Edit execution failed: {e}")
        return {
            "success": False,
            "error": str(e),
        }


# =============================================================================
# Chart Creation - Returns data for frontend rendering
# =============================================================================

def execute_create_chart(
    chart_type: str,
    title: str,
    data: list[dict],
    x_label: str | None = None,
    y_label: str | None = None,
    colors: list[str] | None = None
) -> dict[str, Any]:
    """
    Prepare chart data for frontend rendering with Recharts.
    
    This doesn't actually create the chart - it validates and formats
    the data, which the frontend will render.
    
    Args:
        chart_type: Type of chart (line, bar, pie, area, scatter)
        title: Chart title
        data: Array of data points
        x_label: Optional X axis label
        y_label: Optional Y axis label
        colors: Optional array of colors
    
    Returns:
        dict with formatted chart configuration
    """
    # Validate chart type
    valid_types = ["line", "bar", "pie", "area", "scatter"]
    if chart_type not in valid_types:
        return {
            "success": False,
            "error": f"Invalid chart type. Must be one of: {valid_types}"
        }
    
    # Validate data
    if not data or not isinstance(data, list):
        return {
            "success": False,
            "error": "Data must be a non-empty array"
        }
    
    # Default colors (SA-inspired palette)
    default_colors = [
        "#1a1a1a",  # Black
        "#4a4a4a",  # Dark gray
        "#6a6a6a",  # Medium gray
        "#8a8a8a",  # Light gray
        "#2563eb",  # Blue accent
        "#dc2626",  # Red accent
        "#16a34a",  # Green accent
        "#ca8a04",  # Gold accent
    ]
    
    chart_config = {
        "success": True,
        "chart_type": chart_type,
        "title": title,
        "data": data,
        "x_label": x_label,
        "y_label": y_label,
        "colors": colors or default_colors[:len(data)],
        "render_on": "frontend",  # Indicates frontend should render this
    }
    
    logger.info(f"Created chart config: {chart_type} with {len(data)} data points")
    
    return chart_config


# =============================================================================
# Tool Execution Router
# =============================================================================


# =============================================================================
# Math Tool Execution
# =============================================================================

async def execute_math_tool(
    tool_name: str,
    arguments: dict[str, Any],
    tier: str = "free"
) -> dict[str, Any]:
    """
    Execute a math tool using MathService.
    
    Args:
        tool_name: Name of the math tool (math_statistics, math_financial, etc.)
        arguments: Tool arguments
        tier: User tier (affects available operations)
    
    Returns:
        Tool execution result with display_type for frontend rendering
    """
    from app.services.math_service import get_math_service
    
    service = get_math_service()
    
    try:
        if tool_name == "math_statistics":
            return service.calculate_statistics(
                operation=arguments.get("operation", "summary"),
                data=arguments.get("data", []),
                percentile_value=arguments.get("percentile_value")
            )
        
        elif tool_name == "math_financial":
            return service.calculate_financial(
                operation=arguments.get("operation", "compound_interest"),
                principal=arguments.get("principal"),
                rate=arguments.get("rate"),
                periods=arguments.get("periods"),
                payment=arguments.get("payment"),
                cash_flows=arguments.get("cash_flows"),
                compound_frequency=arguments.get("compound_frequency", "monthly")
            )
        
        elif tool_name == "math_sa_tax":
            return service.calculate_sa_tax(
                annual_income=arguments.get("annual_income", 0),
                age=arguments.get("age", 30),
                medical_scheme_members=arguments.get("medical_scheme_members", 0),
                retirement_contributions=arguments.get("retirement_contributions", 0)
            )
        
        elif tool_name == "math_fraud_analysis":
            # Check tier - fraud analysis is JIGGA only
            if tier.lower() != "jigga":
                return {
                    "success": False,
                    "error": "Fraud analysis is only available on JIGGA tier",
                    "display_type": "alert_cards",
                    "data": {"message": "Upgrade to JIGGA for fraud analysis features"}
                }
            
            return service.fraud_analysis(
                operation=arguments.get("operation", "benfords_law"),
                data=arguments.get("data", []),
                threshold=arguments.get("threshold"),
                sensitivity=arguments.get("sensitivity", "medium")
            )
        
        elif tool_name == "math_probability":
            return service.calculate_probability(
                operation=arguments.get("operation"),
                n=arguments.get("n"),
                r=arguments.get("r"),
                p=arguments.get("p"),
                mean=arguments.get("mean"),
                std_dev=arguments.get("std_dev"),
                x=arguments.get("x"),
                values=arguments.get("values"),
                probabilities=arguments.get("probabilities")
            )
        
        elif tool_name == "math_conversion":
            return service.convert_units(
                value=arguments.get("value", 0),
                from_unit=arguments.get("from_unit", ""),
                to_unit=arguments.get("to_unit", "")
            )
        
        elif tool_name == "python_execute":
            # Python executor for custom calculations
            from app.services.python_executor import get_python_executor
            
            code = arguments.get("code", "")
            description = arguments.get("description", "")
            timeout = arguments.get("timeout", 10)
            
            executor = get_python_executor()
            result = executor.execute(
                code=code,
                description=description,
                timeout=timeout
            )
            
            return {
                "success": result.success,
                "result": result.output,  # For MathResultDisplay
                "output": result.output,
                "error": result.error,
                "execution_time_ms": result.execution_time_ms,
                "display_type": "python_terminal",
                "type": "python_terminal",  # Frontend display hint
                "data": {
                    "code": code,
                    "description": description,
                    "output": result.output,
                }
            }
        
        elif tool_name == "sequential_think":
            # Sequential thinking for multi-step reasoning
            step_number = arguments.get("step_number", 1)
            thought = arguments.get("thought", "")
            calculation = arguments.get("calculation", "")
            intermediate_result = arguments.get("intermediate_result", "")
            needs_more_steps = arguments.get("needs_more_steps", False)
            next_step_plan = arguments.get("next_step_plan", "")
            
            # Build calculation steps for display
            calculation_steps = [
                f"Step {step_number}: {thought}"
            ]
            if calculation:
                calculation_steps.append(f"  Calculation: {calculation}")
            calculation_steps.append(f"  Result: {intermediate_result}")
            
            if needs_more_steps and next_step_plan:
                calculation_steps.append(f"  Next: {next_step_plan}")
            
            return {
                "success": True,
                "step_number": step_number,
                "thought": thought,
                "calculation": calculation,
                "intermediate_result": intermediate_result,
                "needs_more_steps": needs_more_steps,
                "next_step_plan": next_step_plan,
                "result": intermediate_result,  # For MathResultDisplay
                "display_type": "sequential_thinking",
                "type": "sequential_thinking",
                "calculation_steps": calculation_steps,
                "is_final_step": not needs_more_steps,
            }
        
        elif tool_name == "math_delegate":
            # Delegate math computation to 32B model + SymPy
            # 235B calls this to offload computation while focusing on interpretation
            task = arguments.get("task", "")
            context = arguments.get("context", "")
            
            logger.info(f"🧮 MATH DELEGATE: Task = {task[:100]}...")
            
            # Call the internal delegation service
            result = await _execute_math_delegation(task, context)
            
            return result
        
        else:
            return {
                "success": False,
                "error": f"Unknown math tool: {tool_name}",
                "display_type": "alert_cards"
            }
    
    except Exception as e:
        logger.error(f"Math tool execution error: {e}")
        return {
            "success": False,
            "error": str(e),
            "display_type": "alert_cards"
        }


async def execute_backend_tool(
    tool_name: str,
    arguments: dict[str, Any],
    tier: str = "free"
) -> dict[str, Any]:
    """
    Execute a backend tool and return the result.
    
    Args:
        tool_name: Name of the tool to execute
        arguments: Tool arguments
        tier: User tier
    
    Returns:
        Tool execution result
    """
    if tool_name == "generate_image":
        return await execute_generate_image(
            prompt=arguments.get("prompt", ""),
            style=arguments.get("style"),
            tier=tier
        )
    
    elif tool_name == "create_chart":
        return execute_create_chart(
            chart_type=arguments.get("chart_type", "bar"),
            title=arguments.get("title", "Chart"),
            data=arguments.get("data", []),
            x_label=arguments.get("x_label"),
            y_label=arguments.get("y_label"),
            colors=arguments.get("colors")
        )
    
    # Math tools - execute via MathService
    elif tool_name.startswith("math_"):
        return await execute_math_tool(tool_name, arguments, tier)
    
    # Python executor and sequential thinking - also via MathService
    elif tool_name in ("python_execute", "sequential_think"):
        return await execute_math_tool(tool_name, arguments, tier)
    
    # Document generation tool
    elif tool_name == "generate_document":
        from app.tools.document_executor import execute_document_tool
        return await execute_document_tool(
            arguments, 
            tier,
            user_id=arguments.get("user_id", "document_tool"),
        )
    
    # Premium Image Tools - Imagen 4.0 upscale, Imagen 3.0 edit
    elif tool_name == "upscale_image":
        return await execute_upscale_image(
            source_image_id=arguments.get("source_image_id", ""),
            upscale_factor=arguments.get("upscale_factor", "x2"),
            tier=tier
        )
    
    elif tool_name == "edit_image":
        return await execute_edit_image(
            source_image_id=arguments.get("source_image_id", ""),
            edit_prompt=arguments.get("edit_prompt", ""),
            edit_mode=arguments.get("edit_mode", "INPAINT_INSERTION"),
            mask_description=arguments.get("mask_description"),
            tier=tier
        )
    
    else:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}. Supported: generate_image, generate_document, math_*, python_execute, sequential_think",
            "execute_on": "frontend"  # Try frontend execution
        }
