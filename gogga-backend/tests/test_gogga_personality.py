#!/usr/bin/env python3
"""
GOGGA Personality Test Suite for Qwen/JIGGA Tier
================================================

This script tests and refines GOGGA's personality across:
1. All 11 SA official languages
2. Emotional detection (buddy system integration)
3. Professional vs casual tone switching
4. Extended thinking mode for complex queries

Run: python3 test_gogga_personality.py

Author: VCB-AI Development Team
"""

import httpx
import asyncio
import json
from datetime import datetime
from typing import Optional, Literal
from dataclasses import dataclass
from enum import Enum


# ==============================================================================
# CONFIGURATION
# ==============================================================================

API_URL = "http://localhost:8000/api/v1/chat"
TIMEOUT = 120.0  # Qwen thinking can take time


class Mood(Enum):
    """User emotional states that GOGGA should detect"""
    NEUTRAL = "neutral"
    HAPPY = "happy"
    STRESSED = "stressed"
    SAD = "sad"
    ANGRY = "angry"
    ANXIOUS = "anxious"
    EXCITED = "excited"
    PROFESSIONAL = "professional"  # Business mode
    CRISIS = "crisis"  # Needs serious support


class Language(Enum):
    """All 11 SA official languages"""
    EN = "en"   # English
    AF = "af"   # Afrikaans
    ZU = "zu"   # isiZulu
    XH = "xh"   # isiXhosa
    NSO = "nso" # Sepedi
    TN = "tn"   # Setswana
    ST = "st"   # Sesotho
    TS = "ts"   # Xitsonga
    SS = "ss"   # siSwati
    VE = "ve"   # Tshivenda
    NR = "nr"   # isiNdebele


@dataclass
class TestCase:
    """A single test scenario"""
    name: str
    message: str
    expected_mood: Mood
    expected_language: Language
    expected_traits: list[str]  # What we expect in the response
    tier: str = "jigga"  # jigga for thinking mode
    

# ==============================================================================
# TEST SCENARIOS - THE SOUL OF GOGGA
# ==============================================================================

# These test cases define GOGGA's personality through examples
TEST_SCENARIOS = [
    
    # ========== CASUAL GREETINGS (All 11 Languages) ==========
    TestCase(
        name="English Casual Greeting",
        message="Hey, how's it going?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.EN,
        expected_traits=["friendly", "conversational", "no_formal_structure"],
    ),
    TestCase(
        name="Afrikaans Greeting",
        message="Hallo, hoe gaan dit?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.AF,
        expected_traits=["respond_in_afrikaans", "lekker", "natural"],
    ),
    TestCase(
        name="isiZulu Greeting",
        message="Sawubona, unjani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.ZU,
        expected_traits=["respond_in_zulu", "warm", "respectful"],
    ),
    TestCase(
        name="isiXhosa Greeting",
        message="Molo, kunjani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.XH,
        expected_traits=["respond_in_xhosa", "warm", "ubuntu_spirit"],
    ),
    TestCase(
        name="Sepedi Greeting",
        message="Dumela, o kae?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.NSO,
        expected_traits=["respond_in_sepedi", "respectful", "natural"],
    ),
    TestCase(
        name="Setswana Greeting",
        message="Dumela, o tsogile jang?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.TN,
        expected_traits=["respond_in_setswana", "warm", "traditional"],
    ),
    TestCase(
        name="Sesotho Greeting",
        message="Dumela, u phela joang?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.ST,
        expected_traits=["respond_in_sesotho", "respectful", "warm"],
    ),
    TestCase(
        name="Xitsonga Greeting",
        message="Avuxeni, u njhani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.TS,
        expected_traits=["respond_in_xitsonga", "friendly", "natural"],
    ),
    TestCase(
        name="siSwati Greeting",
        message="Sawubona, unjani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.SS,
        expected_traits=["respond_in_siswati", "warm", "respectful"],
    ),
    TestCase(
        name="Tshivenda Greeting",
        message="Ndaa, vho vuwa hani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.VE,
        expected_traits=["respond_in_tshivenda", "respectful", "traditional"],
    ),
    TestCase(
        name="isiNdebele Greeting",
        message="Lotjhani, unjani?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.NR,
        expected_traits=["respond_in_ndebele", "warm", "natural"],
    ),
    
    # ========== EMOTIONAL DETECTION (The Buddy System) ==========
    TestCase(
        name="User in Crisis - Need Support",
        message="I don't know what to do anymore. I feel like giving up.",
        expected_mood=Mood.CRISIS,
        expected_language=Language.EN,
        expected_traits=["no_jokes", "empathetic", "supportive", "resources_if_needed", "serious_tone"],
    ),
    TestCase(
        name="User Stressed About Work",
        message="Eish, this job is killing me. My boss is impossible and deadlines are crazy.",
        expected_mood=Mood.STRESSED,
        expected_language=Language.EN,
        expected_traits=["empathetic", "practical_advice", "light_humor_ok", "sa_understanding"],
    ),
    TestCase(
        name="User Celebrating Good News",
        message="Yoh! I got the promotion! R15k increase bru!",
        expected_mood=Mood.EXCITED,
        expected_language=Language.EN,
        expected_traits=["celebrate_with_them", "enthusiastic", "sa_slang_ok", "warm"],
    ),
    TestCase(
        name="User Sad About Loss",
        message="My grandmother passed away yesterday. We were very close.",
        expected_mood=Mood.SAD,
        expected_language=Language.EN,
        expected_traits=["no_jokes", "deeply_empathetic", "ubuntu_spirit", "respectful_of_grief"],
    ),
    TestCase(
        name="User Anxious About Future",
        message="I'm so worried about the economy. What if I lose my job with all this load shedding affecting businesses?",
        expected_mood=Mood.ANXIOUS,
        expected_language=Language.EN,
        expected_traits=["reassuring", "practical", "sa_context_aware", "empathetic"],
    ),
    TestCase(
        name="User Angry About Injustice",
        message="My landlord just locked me out! No notice, nothing! This is illegal!",
        expected_mood=Mood.ANGRY,
        expected_language=Language.EN,
        expected_traits=["validate_anger", "on_their_side", "legal_help", "action_oriented"],
    ),
    
    # ========== PROFESSIONAL REQUESTS (Extended Thinking) ==========
    TestCase(
        name="Formal Legal Analysis Request",
        message="Write me a comprehensive legal analysis of my options under the Rental Housing Act. My landlord hasn't fixed the geyser in 3 months despite multiple requests.",
        expected_mood=Mood.PROFESSIONAL,
        expected_language=Language.EN,
        expected_traits=["structured", "thorough", "cite_sa_law", "actionable", "still_has_personality"],
    ),
    TestCase(
        name="Business Strategy Request",
        message="I need a detailed business plan for a spaza shop in Soweto. Include startup costs in Rands, competition analysis, and marketing strategy.",
        expected_mood=Mood.PROFESSIONAL,
        expected_language=Language.EN,
        expected_traits=["comprehensive", "sa_market_aware", "realistic_costs", "practical", "local_context"],
    ),
    TestCase(
        name="Technical Architecture Request",
        message="Design me a system architecture for a mobile banking app that works offline during load shedding. Include security considerations for POPIA compliance.",
        expected_mood=Mood.PROFESSIONAL,
        expected_language=Language.EN,
        expected_traits=["technical_depth", "sa_context", "practical_constraints", "security_aware"],
    ),
    
    # ========== CODE-SWITCHING (Natural SA Communication) ==========
    TestCase(
        name="Mixed English-Afrikaans",
        message="Ag nee man, dis terrible. Can you help me sort this out?",
        expected_mood=Mood.STRESSED,
        expected_language=Language.EN,  # Dominant language
        expected_traits=["code_switch_naturally", "understand_mixed", "respond_appropriately"],
    ),
    TestCase(
        name="SA Slang Heavy",
        message="Yoh china, this oke is giving me grief. Just now he's gonna lank me out of the position. How do I handle this, bru?",
        expected_mood=Mood.ANXIOUS,
        expected_language=Language.EN,
        expected_traits=["understand_slang", "respond_in_kind", "practical_advice", "relatable"],
    ),
    
    # ========== EDGE CASES ==========
    TestCase(
        name="User Requests No Jokes",
        message="Look, I need you to be serious. No jokes. I have a court date tomorrow about custody.",
        expected_mood=Mood.PROFESSIONAL,
        expected_language=Language.EN,
        expected_traits=["immediately_serious", "no_sarcasm", "professional", "helpful", "legal_aware"],
    ),
    TestCase(
        name="Simple Question After Complex Query",
        message="Thanks for the legal stuff. What's the weather like today?",
        expected_mood=Mood.NEUTRAL,
        expected_language=Language.EN,
        expected_traits=["context_switch", "casual_again", "friendly", "acknowledge_transition"],
    ),
]


# ==============================================================================
# API CLIENT
# ==============================================================================

async def send_chat_message(
    message: str,
    user_tier: str = "jigga",
    user_id: str = "personality_test"
) -> dict:
    """Send a message to GOGGA and get the response."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            response = await client.post(
                API_URL,
                json={
                    "message": message,
                    "user_id": user_id,
                    "user_tier": user_tier,
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"error": str(e)}


# ==============================================================================
# TEST RUNNER
# ==============================================================================

async def run_single_test(test: TestCase, verbose: bool = True) -> dict:
    """Run a single test case and return results."""
    print(f"\n{'='*60}")
    print(f"TEST: {test.name}")
    print(f"{'='*60}")
    print(f"INPUT: {test.message}")
    print(f"EXPECTED: Mood={test.expected_mood.value}, Lang={test.expected_language.value}")
    print(f"TRAITS: {', '.join(test.expected_traits)}")
    print("-" * 60)
    
    result = await send_chat_message(test.message, test.tier)
    
    if "error" in result:
        print(f"ERROR: {result['error']}")
        return {"test": test.name, "status": "error", "error": result["error"]}
    
    response = result.get("response", "")
    thinking = result.get("thinking", "")
    meta = result.get("meta", {})
    
    if verbose:
        if thinking:
            print(f"\n[THINKING BLOCK - {len(thinking)} chars]")
            # Show first 500 chars of thinking
            print(thinking[:500] + "..." if len(thinking) > 500 else thinking)
        
        print(f"\n[RESPONSE]")
        print(response[:1000] + "..." if len(response) > 1000 else response)
        
        print(f"\n[META] Layer: {meta.get('layer')}, Model: {meta.get('model')}")
        if meta.get("tokens"):
            print(f"[TOKENS] In: {meta['tokens'].get('input', '?')}, Out: {meta['tokens'].get('output', '?')}")
    
    return {
        "test": test.name,
        "status": "success",
        "response": response,
        "thinking": thinking,
        "meta": meta,
        "input": test.message,
        "expected_mood": test.expected_mood.value,
        "expected_language": test.expected_language.value,
        "expected_traits": test.expected_traits,
    }


async def run_language_tests() -> list[dict]:
    """Run all 11 language greeting tests."""
    print("\n" + "=" * 80)
    print("PART 1: LANGUAGE DETECTION (All 11 SA Official Languages)")
    print("=" * 80)
    
    results = []
    for test in TEST_SCENARIOS:
        if "Greeting" in test.name:
            result = await run_single_test(test)
            results.append(result)
            await asyncio.sleep(0.5)  # Rate limiting
    
    return results


async def run_emotional_tests() -> list[dict]:
    """Run emotional detection tests."""
    print("\n" + "=" * 80)
    print("PART 2: EMOTIONAL DETECTION (Buddy System)")
    print("=" * 80)
    
    results = []
    mood_tests = [t for t in TEST_SCENARIOS if t.expected_mood != Mood.NEUTRAL and t.expected_mood != Mood.PROFESSIONAL]
    
    for test in mood_tests:
        result = await run_single_test(test)
        results.append(result)
        await asyncio.sleep(0.5)
    
    return results


async def run_professional_tests() -> list[dict]:
    """Run professional/formal request tests."""
    print("\n" + "=" * 80)
    print("PART 3: PROFESSIONAL MODE (Extended Thinking)")
    print("=" * 80)
    
    results = []
    pro_tests = [t for t in TEST_SCENARIOS if t.expected_mood == Mood.PROFESSIONAL]
    
    for test in pro_tests:
        result = await run_single_test(test)
        results.append(result)
        await asyncio.sleep(1.0)  # Longer wait for thinking mode
    
    return results


async def run_code_switching_tests() -> list[dict]:
    """Run code-switching and slang tests."""
    print("\n" + "=" * 80)
    print("PART 4: CODE-SWITCHING & SA SLANG")
    print("=" * 80)
    
    results = []
    switch_tests = [t for t in TEST_SCENARIOS if "Mixed" in t.name or "Slang" in t.name]
    
    for test in switch_tests:
        result = await run_single_test(test)
        results.append(result)
        await asyncio.sleep(0.5)
    
    return results


async def run_all_tests() -> dict:
    """Run the complete test suite."""
    print("\n" + "#" * 80)
    print("#" + " " * 78 + "#")
    print("#" + "  GOGGA PERSONALITY TEST SUITE - QWEN/JIGGA TIER  ".center(78) + "#")
    print("#" + f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ".center(78) + "#")
    print("#" + " " * 78 + "#")
    print("#" * 80)
    
    all_results = {
        "timestamp": datetime.now().isoformat(),
        "language_tests": await run_language_tests(),
        "emotional_tests": await run_emotional_tests(),
        "professional_tests": await run_professional_tests(),
        "code_switching_tests": await run_code_switching_tests(),
    }
    
    # Summary
    total = sum(len(r) for r in all_results.values() if isinstance(r, list))
    successes = sum(
        1 for r in [item for sublist in all_results.values() if isinstance(sublist, list) for item in sublist]
        if r.get("status") == "success"
    )
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {total}")
    print(f"Successful: {successes}")
    print(f"Failed: {total - successes}")
    
    return all_results


async def interactive_test():
    """Interactive mode for testing specific scenarios."""
    print("\n" + "=" * 60)
    print("INTERACTIVE GOGGA PERSONALITY TEST")
    print("=" * 60)
    print("Type messages to test GOGGA's response.")
    print("Commands: /quit, /jive, /jigga, /free")
    print("-" * 60)
    
    tier = "jigga"
    
    while True:
        try:
            user_input = input(f"\n[{tier.upper()}] You: ").strip()
            
            if not user_input:
                continue
            
            if user_input == "/quit":
                print("Goodbye!")
                break
            elif user_input == "/jive":
                tier = "jive"
                print(f"Switched to {tier.upper()} tier")
                continue
            elif user_input == "/jigga":
                tier = "jigga"
                print(f"Switched to {tier.upper()} tier")
                continue
            elif user_input == "/free":
                tier = "free"
                print(f"Switched to {tier.upper()} tier")
                continue
            
            result = await send_chat_message(user_input, tier)
            
            if "error" in result:
                print(f"Error: {result['error']}")
            else:
                thinking = result.get("thinking", "")
                response = result.get("response", "")
                meta = result.get("meta", {})
                
                if thinking:
                    print(f"\n[Thinking: {len(thinking)} chars]")
                
                print(f"\nGOGGA: {response}")
                print(f"\n[Layer: {meta.get('layer', '?')} | Tokens: {meta.get('tokens', {}).get('output', '?')}]")
                
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


# ==============================================================================
# MAIN
# ==============================================================================

if __name__ == "__main__":
    import sys
    
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ██████   ██████   ██████   ██████   █████                                 ║
║  ██       ██    ██ ██       ██       ██   ██                                ║
║  ██   ███ ██    ██ ██   ███ ██   ███ ███████                                ║
║  ██    ██ ██    ██ ██    ██ ██    ██ ██   ██                                ║
║   ██████   ██████   ██████   ██████  ██   ██                                ║
║                                                                              ║
║           PERSONALITY TEST SUITE - QWEN/JIGGA TIER                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--interactive":
        asyncio.run(interactive_test())
    elif len(sys.argv) > 1 and sys.argv[1] == "--quick":
        # Just run a few key tests
        async def quick_test():
            print("Running quick personality check...")
            tests = [
                ("Casual greeting", "Hey, how's it going?"),
                ("isiZulu greeting", "Sawubona, unjani?"),
                ("Emotional support", "I'm really struggling today, feeling down."),
                ("Professional request", "Write me a brief legal analysis of my CCMA case options."),
            ]
            for name, msg in tests:
                print(f"\n>>> {name}: {msg}")
                result = await send_chat_message(msg)
                if "error" not in result:
                    print(f"GOGGA: {result.get('response', '')[:300]}...")
                else:
                    print(f"Error: {result['error']}")
                await asyncio.sleep(0.5)
        asyncio.run(quick_test())
    else:
        # Run full test suite
        asyncio.run(run_all_tests())
