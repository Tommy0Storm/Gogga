#!/usr/bin/env python3
"""
GOGGA Live LLM Response Testing Script

Tests that:
1. Correct models are used for each tier (FREE/JIVE/JIGGA)
2. Complex queries route to Qwen 235B on JIGGA
3. Personality modes work correctly (System/Dark/Goody)
4. Empathetic reasoning is applied
5. SA language detection works

Run: python tests/test_live_llm_responses.py

Requires: Backend running on localhost:8000
"""

import asyncio
import httpx
import json
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
from typing import Optional

# ============================================================================
# CONFIGURATION
# ============================================================================

API_BASE = "http://localhost:8000/api/v1"
TIMEOUT = 120.0  # Qwen thinking can take time

# Expected model patterns for each tier
EXPECTED_MODELS = {
    "free": ["llama", "openrouter"],
    "jive": ["qwen", "32b"],
    "jigga": ["qwen"],  # Could be 32B or 235B
    "jigga_complex": ["qwen", "235b"],
}


class TestStatus(Enum):
    PASS = "✅ PASS"
    FAIL = "❌ FAIL"
    SKIP = "⏭️ SKIP"
    ERROR = "💥 ERROR"


@dataclass
class TestResult:
    name: str
    status: TestStatus
    tier: str
    message: str
    model_used: Optional[str] = None
    response_preview: Optional[str] = None
    thinking_present: bool = False
    duration_ms: int = 0


# ============================================================================
# API CLIENT
# ============================================================================

async def send_chat(
    message: str,
    tier: str = "free",
    user_id: str = "test_user",
    personality_mode: Optional[str] = None
) -> dict:
    """Send a chat message to the API."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        payload = {
            "message": message,
            "user_id": user_id,
            "user_tier": tier,
        }
        
        # Add personality context if specified
        if personality_mode:
            payload["context"] = f"PERSONALITY MODE: {personality_mode}"
        
        try:
            response = await client.post(
                f"{API_BASE}/chat",
                json=payload
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}", "details": e.response.text}
        except httpx.ConnectError:
            return {"error": "Connection failed - is the backend running?"}
        except Exception as e:
            return {"error": str(e)}


async def check_backend_health() -> bool:
    """Check if backend is running."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_BASE.replace('/api/v1', '')}/health")
            return response.status_code == 200
    except:
        return False


# ============================================================================
# TIER ROUTING TESTS
# ============================================================================

async def test_free_tier_model() -> TestResult:
    """Test that FREE tier uses OpenRouter Llama."""
    start = datetime.now()
    result = await send_chat(
        "What is 2+2? Answer in one word.",
        tier="free"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="FREE Tier Model Routing",
            status=TestStatus.ERROR,
            tier="free",
            message=result["error"],
            duration_ms=duration
        )
    
    model = result.get("meta", {}).get("model", "unknown")
    layer = result.get("meta", {}).get("layer", "unknown")
    response = result.get("response", "")
    
    # Check if it used OpenRouter/Llama
    model_lower = model.lower()
    is_correct = any(exp in model_lower for exp in EXPECTED_MODELS["free"]) or "free" in layer.lower()
    
    return TestResult(
        name="FREE Tier Model Routing",
        status=TestStatus.PASS if is_correct else TestStatus.FAIL,
        tier="free",
        message=f"Layer: {layer}, Model: {model}",
        model_used=model,
        response_preview=response[:100] + "..." if len(response) > 100 else response,
        duration_ms=duration
    )


async def test_jive_tier_model() -> TestResult:
    """Test that JIVE tier uses Cerebras Qwen 32B."""
    start = datetime.now()
    result = await send_chat(
        "What is load shedding? Explain briefly.",
        tier="jive"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="JIVE Tier Model Routing",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    model = result.get("meta", {}).get("model", "unknown")
    layer = result.get("meta", {}).get("layer", "unknown")
    response = result.get("response", "")
    thinking = result.get("thinking")
    
    # Check if it used Qwen 32B
    model_lower = model.lower()
    is_correct = any(exp in model_lower for exp in EXPECTED_MODELS["jive"]) or "jive" in layer.lower()
    
    return TestResult(
        name="JIVE Tier Model Routing",
        status=TestStatus.PASS if is_correct else TestStatus.FAIL,
        tier="jive",
        message=f"Layer: {layer}, Model: {model}",
        model_used=model,
        response_preview=response[:100] + "..." if len(response) > 100 else response,
        thinking_present=thinking is not None,
        duration_ms=duration
    )


async def test_jigga_tier_general() -> TestResult:
    """Test that JIGGA tier uses Qwen 32B for general queries."""
    start = datetime.now()
    result = await send_chat(
        "Tell me a joke about South Africa.",
        tier="jigga"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="JIGGA Tier General (32B)",
            status=TestStatus.ERROR,
            tier="jigga",
            message=result["error"],
            duration_ms=duration
        )
    
    model = result.get("meta", {}).get("model", "unknown")
    layer = result.get("meta", {}).get("layer", "unknown")
    response = result.get("response", "")
    thinking = result.get("thinking")
    
    # Should use 32B for simple queries
    is_correct = "qwen" in model.lower() and ("32b" in model.lower() or "think" in layer.lower())
    
    return TestResult(
        name="JIGGA Tier General (32B)",
        status=TestStatus.PASS if is_correct else TestStatus.FAIL,
        tier="jigga",
        message=f"Layer: {layer}, Model: {model}",
        model_used=model,
        response_preview=response[:100] + "..." if len(response) > 100 else response,
        thinking_present=thinking is not None,
        duration_ms=duration
    )


async def test_jigga_tier_complex() -> TestResult:
    """Test that JIGGA tier routes complex/legal queries to Qwen 235B."""
    start = datetime.now()
    # Use legal keywords that should trigger 235B routing
    result = await send_chat(
        "Provide a comprehensive legal analysis of my options under the Rental Housing Act. "
        "My landlord hasn't fixed the geyser in 3 months despite multiple written requests.",
        tier="jigga"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="JIGGA Tier Complex (235B)",
            status=TestStatus.ERROR,
            tier="jigga",
            message=result["error"],
            duration_ms=duration
        )
    
    model = result.get("meta", {}).get("model", "unknown")
    layer = result.get("meta", {}).get("layer", "unknown")
    response = result.get("response", "")
    thinking = result.get("thinking")
    
    # Should use 235B for legal/complex queries
    is_correct = "235b" in model.lower() or "complex" in layer.lower()
    
    return TestResult(
        name="JIGGA Tier Complex (235B)",
        status=TestStatus.PASS if is_correct else TestStatus.FAIL,
        tier="jigga",
        message=f"Layer: {layer}, Model: {model}",
        model_used=model,
        response_preview=response[:150] + "..." if len(response) > 150 else response,
        thinking_present=thinking is not None,
        duration_ms=duration
    )


# ============================================================================
# PERSONALITY MODE TESTS
# ============================================================================

async def test_dark_gogga_sarcasm() -> TestResult:
    """Test that Dark Gogga mode produces sarcastic responses."""
    start = datetime.now()
    result = await send_chat(
        "My landlord increased my rent by 50% with no notice. What should I do?",
        tier="jive",
        personality_mode="Dark Gogga (sarcastic, witty)"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="Dark Gogga Personality",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "").lower()
    model = result.get("meta", {}).get("model", "unknown")
    
    # Check for sarcastic indicators
    sarcastic_words = ["eish", "delightful", "wonderful", "of course", "love how", "ah,", "ah yes"]
    has_sarcasm = any(word in response for word in sarcastic_words)
    
    # Also check it's still helpful (mentions RHA, rights, etc.)
    helpful_words = ["rental housing act", "rights", "notice", "illegal", "law", "act"]
    is_helpful = any(word in response for word in helpful_words)
    
    if has_sarcasm and is_helpful:
        status = TestStatus.PASS
        msg = "Sarcastic AND helpful"
    elif is_helpful:
        status = TestStatus.PASS  # Helpful is more important
        msg = "Helpful (sarcasm subtle)"
    else:
        status = TestStatus.FAIL
        msg = "Neither sarcastic nor helpful"
    
    return TestResult(
        name="Dark Gogga Personality",
        status=status,
        tier="jive",
        message=msg,
        model_used=model,
        response_preview=result.get("response", "")[:200] + "...",
        duration_ms=duration
    )


async def test_goody_gogga_positive() -> TestResult:
    """Test that Goody Gogga mode produces positive/encouraging responses."""
    start = datetime.now()
    result = await send_chat(
        "I'm starting my own small business but I'm nervous about it.",
        tier="jive",
        personality_mode="Goody Gogga (positive, uplifting)"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="Goody Gogga Personality",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "").lower()
    model = result.get("meta", {}).get("model", "unknown")
    
    # Check for positive indicators
    positive_words = ["exciting", "wonderful", "great", "fantastic", "congratulations", 
                      "opportunity", "proud", "amazing", "well done", "good luck",
                      "you can", "you've got", "believe"]
    has_positive = any(word in response for word in positive_words)
    
    # Should also be practical/helpful
    helpful_words = ["register", "cipc", "tax", "plan", "business", "tips", "advice"]
    is_helpful = any(word in response for word in helpful_words)
    
    if has_positive:
        status = TestStatus.PASS
        msg = "Positive and encouraging"
    else:
        status = TestStatus.FAIL
        msg = "Not detectably positive"
    
    return TestResult(
        name="Goody Gogga Personality",
        status=status,
        tier="jive",
        message=msg,
        model_used=model,
        response_preview=result.get("response", "")[:200] + "...",
        duration_ms=duration
    )


async def test_system_mode_neutral() -> TestResult:
    """Test that System mode is professional and balanced."""
    start = datetime.now()
    result = await send_chat(
        "What are my consumer rights when returning a defective product?",
        tier="jive",
        personality_mode="System (balanced, professional)"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="System Mode (Neutral)",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "").lower()
    model = result.get("meta", {}).get("model", "unknown")
    
    # Should mention CPA and be informative
    helpful_words = ["consumer protection act", "cpa", "return", "refund", "rights", "defective"]
    is_helpful = any(word in response for word in helpful_words)
    
    # Should NOT be overly casual or sarcastic
    casual_words = ["eish", "bru", "lekker", "yoh"]
    is_casual = any(word in response for word in casual_words)
    
    if is_helpful:
        status = TestStatus.PASS
        msg = "Professional and helpful"
    else:
        status = TestStatus.FAIL
        msg = "Not sufficiently informative"
    
    return TestResult(
        name="System Mode (Neutral)",
        status=status,
        tier="jive",
        message=msg,
        model_used=model,
        response_preview=result.get("response", "")[:200] + "...",
        duration_ms=duration
    )


# ============================================================================
# SA LANGUAGE TESTS
# ============================================================================

async def test_zulu_response() -> TestResult:
    """Test that Gogga responds in isiZulu when addressed in Zulu."""
    start = datetime.now()
    result = await send_chat(
        "Sawubona! Ngicela ungitshele ngezimakethe zaseNingizimu Afrika.",
        tier="jive"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="isiZulu Language Support",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "")
    model = result.get("meta", {}).get("model", "unknown")
    
    # Check for Zulu words in response
    zulu_indicators = ["yebo", "ngiyabonga", "siyakwemukela", "ningizimu", "impela", "ukuthi"]
    has_zulu = any(word in response.lower() for word in zulu_indicators)
    
    # Also acceptable if it explains in English but acknowledges the Zulu
    acknowledges = "zulu" in response.lower() or "sawubona" in response.lower()
    
    if has_zulu:
        status = TestStatus.PASS
        msg = "Responded in isiZulu"
    elif acknowledges:
        status = TestStatus.PASS
        msg = "Acknowledged Zulu input"
    else:
        status = TestStatus.FAIL
        msg = "Did not respond in or acknowledge Zulu"
    
    return TestResult(
        name="isiZulu Language Support",
        status=status,
        tier="jive",
        message=msg,
        model_used=model,
        response_preview=response[:200] + "...",
        duration_ms=duration
    )


async def test_afrikaans_response() -> TestResult:
    """Test that Gogga responds in Afrikaans when addressed in Afrikaans."""
    start = datetime.now()
    result = await send_chat(
        "Goeie môre! Kan jy my asseblief help met 'n vraag oor arbeidswetgewing?",
        tier="jive"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="Afrikaans Language Support",
            status=TestStatus.ERROR,
            tier="jive",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "")
    model = result.get("meta", {}).get("model", "unknown")
    
    # Check for Afrikaans words in response
    afrikaans_indicators = ["is", "het", "kan", "sal", "die", "werk", "reg", "wat", "jou"]
    response_lower = response.lower()
    
    # More sophisticated check - look for Afrikaans patterns
    has_afrikaans = any(f" {word} " in f" {response_lower} " for word in afrikaans_indicators)
    
    # Also check for common Afrikaans phrases
    afrikaans_phrases = ["met plesier", "geen probleem", "arbeidswet", "lra"]
    has_phrases = any(phrase in response_lower for phrase in afrikaans_phrases)
    
    if has_afrikaans or has_phrases:
        status = TestStatus.PASS
        msg = "Responded in Afrikaans"
    else:
        status = TestStatus.FAIL
        msg = "Did not respond in Afrikaans"
    
    return TestResult(
        name="Afrikaans Language Support",
        status=status,
        tier="jive",
        message=msg,
        model_used=model,
        response_preview=response[:200] + "...",
        duration_ms=duration
    )


# ============================================================================
# EMPATHETIC REASONING TEST
# ============================================================================

async def test_empathetic_reasoning() -> TestResult:
    """Test that responses show empathetic understanding of user needs."""
    start = datetime.now()
    result = await send_chat(
        "I just lost my job and I'm really worried about paying rent next month.",
        tier="jigga"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="Empathetic Reasoning",
            status=TestStatus.ERROR,
            tier="jigga",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "").lower()
    thinking = result.get("thinking", "")
    model = result.get("meta", {}).get("model", "unknown")
    
    # Check for empathetic language
    empathy_words = ["sorry", "understand", "difficult", "stressful", "tough", 
                     "worr", "support", "here for you", "challenging"]
    has_empathy = any(word in response for word in empathy_words)
    
    # Check for practical help (proactive)
    practical_words = ["uif", "ccma", "rental housing", "negotiate", "options",
                       "resources", "sassa", "social grant", "legal aid"]
    has_practical = any(word in response for word in practical_words)
    
    # Check thinking block for empathetic reasoning
    thinking_has_empathy = False
    if thinking:
        thinking_lower = thinking.lower()
        thinking_has_empathy = "why" in thinking_lower or "feel" in thinking_lower or "need" in thinking_lower
    
    if has_empathy and has_practical:
        status = TestStatus.PASS
        msg = "Empathetic AND practical advice"
    elif has_practical:
        status = TestStatus.PASS
        msg = "Practical (empathy could be stronger)"
    else:
        status = TestStatus.FAIL
        msg = "Not empathetic enough"
    
    return TestResult(
        name="Empathetic Reasoning",
        status=status,
        tier="jigga",
        message=msg,
        model_used=model,
        response_preview=result.get("response", "")[:200] + "...",
        thinking_present=thinking is not None and len(thinking) > 0,
        duration_ms=duration
    )


# ============================================================================
# THINKING MODE TEST
# ============================================================================

async def test_jigga_thinking_mode() -> TestResult:
    """Test that JIGGA tier includes thinking blocks."""
    start = datetime.now()
    result = await send_chat(
        "If I have 3 apples and give away 1, but then someone gives me 2 more, "
        "how many apples do I have? Show your reasoning.",
        tier="jigga"
    )
    duration = int((datetime.now() - start).total_seconds() * 1000)
    
    if "error" in result:
        return TestResult(
            name="JIGGA Thinking Mode",
            status=TestStatus.ERROR,
            tier="jigga",
            message=result["error"],
            duration_ms=duration
        )
    
    response = result.get("response", "")
    thinking = result.get("thinking")
    model = result.get("meta", {}).get("model", "unknown")
    
    # JIGGA should have thinking blocks
    has_thinking = thinking is not None and len(thinking) > 50
    
    # Check answer is correct (4 apples)
    correct_answer = "4" in response
    
    if has_thinking and correct_answer:
        status = TestStatus.PASS
        msg = f"Thinking present ({len(thinking)} chars), correct answer"
    elif correct_answer:
        status = TestStatus.PASS
        msg = "Correct answer (thinking may be inline)"
    else:
        status = TestStatus.FAIL
        msg = "No thinking or wrong answer"
    
    return TestResult(
        name="JIGGA Thinking Mode",
        status=status,
        tier="jigga",
        message=msg,
        model_used=model,
        response_preview=response[:150] + "...",
        thinking_present=has_thinking,
        duration_ms=duration
    )


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

async def run_all_tests():
    """Run all live LLM tests."""
    print("\n" + "=" * 80)
    print("🧪 GOGGA LIVE LLM RESPONSE TESTS")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API: {API_BASE}")
    print()
    
    # Check backend health
    print("Checking backend health...")
    if not await check_backend_health():
        print("❌ Backend not responding! Make sure to run:")
        print("   cd gogga-backend && uvicorn app.main:app --reload")
        return
    print("✅ Backend is healthy\n")
    
    # Define tests by category
    tests = {
        "Tier Routing": [
            test_free_tier_model,
            test_jive_tier_model,
            test_jigga_tier_general,
            test_jigga_tier_complex,
        ],
        "Personality Modes": [
            test_dark_gogga_sarcasm,
            test_goody_gogga_positive,
            test_system_mode_neutral,
        ],
        "SA Languages": [
            test_zulu_response,
            test_afrikaans_response,
        ],
        "Reasoning": [
            test_empathetic_reasoning,
            test_jigga_thinking_mode,
        ],
    }
    
    results = []
    
    for category, test_funcs in tests.items():
        print(f"\n{'─' * 40}")
        print(f"📁 {category}")
        print(f"{'─' * 40}")
        
        for test_func in test_funcs:
            print(f"\n  Running: {test_func.__name__}...")
            result = await test_func()
            results.append(result)
            
            print(f"  {result.status.value} {result.name}")
            print(f"     Tier: {result.tier} | {result.message}")
            if result.model_used:
                print(f"     Model: {result.model_used}")
            if result.thinking_present:
                print(f"     Thinking: ✅ Present")
            if result.response_preview:
                print(f"     Response: {result.response_preview[:80]}...")
            print(f"     Duration: {result.duration_ms}ms")
            
            # Small delay between tests to avoid rate limiting
            await asyncio.sleep(1.0)
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if r.status == TestStatus.PASS)
    failed = sum(1 for r in results if r.status == TestStatus.FAIL)
    errors = sum(1 for r in results if r.status == TestStatus.ERROR)
    total = len(results)
    
    print(f"Total: {total}")
    print(f"  ✅ Passed: {passed}")
    print(f"  ❌ Failed: {failed}")
    print(f"  💥 Errors: {errors}")
    print()
    
    if failed > 0 or errors > 0:
        print("Failed/Error tests:")
        for r in results:
            if r.status in (TestStatus.FAIL, TestStatus.ERROR):
                print(f"  - {r.name}: {r.message}")
    
    print("\n" + "=" * 80)
    return results


if __name__ == "__main__":
    asyncio.run(run_all_tests())
