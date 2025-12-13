#!/usr/bin/env python3
"""
Test all 11 official South African languages.

Languages:
1. English
2. Afrikaans
3. isiZulu
4. isiXhosa
5. Sesotho (Southern Sotho)
6. Setswana
7. Sepedi (Northern Sotho)
8. Tshivenda
9. Xitsonga
10. siSwati
11. isiNdebele
"""

import asyncio
import httpx
from dataclasses import dataclass
from datetime import datetime

API_BASE = "http://localhost:8000/api/v1"
TIMEOUT = 60.0


@dataclass
class LanguageTest:
    name: str
    code: str
    greeting: str
    question: str
    expected_words: list[str]  # Words that indicate response is in that language


# All 11 SA official languages with test prompts
SA_LANGUAGES = [
    LanguageTest(
        name="English",
        code="en",
        greeting="Hello!",
        question="Hello! What is load shedding? Please answer briefly.",
        expected_words=["load", "shedding", "eskom", "power", "electricity"],
    ),
    LanguageTest(
        name="Afrikaans",
        code="af",
        greeting="Goeie môre!",
        question="Goeie môre! Wat is beurtkrag? Antwoord asseblief kortliks.",
        expected_words=["is", "die", "krag", "elektrisiteit", "eskom", "af", "beurtkrag"],
    ),
    LanguageTest(
        name="isiZulu",
        code="zu",
        greeting="Sawubona!",
        question="Sawubona! Yini ukucishwa kukagesi? Ngicela uphendule ngokufushane.",
        expected_words=["sawubona", "yebo", "ukuthi", "ugesi", "eskom", "amandla", "ngiyabonga"],
    ),
    LanguageTest(
        name="isiXhosa",
        code="xh",
        greeting="Molo!",
        question="Molo! Yintoni ukucinywa kombane? Nceda uphendule ngokufutshane.",
        expected_words=["molo", "enkosi", "umbane", "eskom", "amandla", "ukuthi", "ewe"],
    ),
    LanguageTest(
        name="Sesotho",
        code="st",
        greeting="Dumela!",
        question="Dumela! Ke eng ho tima motlakase? Ka kopo araba ka bokhutšoanyane.",
        expected_words=["dumela", "motlakase", "eskom", "ke", "ho", "leboga", "ea"],
    ),
    LanguageTest(
        name="Setswana",
        code="tn",
        greeting="Dumela!",
        question="Dumela! Ke eng go tima motlakase? Tsweetswee araba ka bokhutshwane.",
        expected_words=["dumela", "motlakase", "eskom", "ke", "go", "leboga", "a"],
    ),
    LanguageTest(
        name="Sepedi",
        code="nso",
        greeting="Thobela!",
        question="Thobela! Ke eng go tima mohlagase? Hle araba ka bokopana.",
        expected_words=["thobela", "mohlagase", "eskom", "ke", "go", "leboga", "a"],
    ),
    LanguageTest(
        name="Tshivenda",
        code="ve",
        greeting="Ndaa!",
        question="Ndaa! Ndi mini u dzima muḓagasi? Ndi humbela uri ni fhindule nga u pfufhifhadza.",
        expected_words=["ndaa", "muḓagasi", "mudagasi", "eskom", "ndi", "livhuwa", "a"],
    ),
    LanguageTest(
        name="Xitsonga",
        code="ts",
        greeting="Avuxeni!",
        question="Avuxeni! I yini ku tshika gezi? Ndzi kombela ku hlamula hi ku koma.",
        expected_words=["avuxeni", "gezi", "eskom", "hi", "ku", "ndza", "khensa"],
    ),
    LanguageTest(
        name="siSwati",
        code="ss",
        greeting="Sawubona!",
        question="Sawubona! Yini kucisha ugesi? Ngicela uphendvule ngekufisha.",
        expected_words=["sawubona", "yebo", "ugesi", "eskom", "ngiyabonga", "ku"],
    ),
    LanguageTest(
        name="isiNdebele",
        code="nr",
        greeting="Lotjhani!",
        question="Lotjhani! Yini ukucinywa kombani? Ngibawa uphendule ngokufitjhazana.",
        expected_words=["lotjhani", "kombani", "eskom", "ku", "ngiyathokoza", "a"],
    ),
]


async def test_language(lang: LanguageTest, tier: str = "jive") -> dict:
    """Test a single language."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            start = datetime.now()
            response = await client.post(
                f"{API_BASE}/chat",
                json={
                    "message": lang.question,
                    "user_id": "lang_test",
                    "user_tier": tier,
                }
            )
            duration = int((datetime.now() - start).total_seconds() * 1000)
            
            if response.status_code != 200:
                return {
                    "language": lang.name,
                    "status": "❌ ERROR",
                    "message": f"HTTP {response.status_code}",
                    "duration_ms": duration,
                }
            
            data = response.json()
            response_text = data.get("response", "").lower()
            model = data.get("meta", {}).get("model", "unknown")
            
            # Check if response contains expected language indicators
            matches = [word for word in lang.expected_words if word.lower() in response_text]
            
            # For non-English, we want to see some language-specific words
            # For English, we just check it's coherent about load shedding
            if lang.code == "en":
                passed = any(word in response_text for word in ["load", "shedding", "power", "electricity", "eskom"])
            else:
                # At least acknowledge the greeting or use some expected words
                passed = len(matches) >= 1 or lang.greeting.lower().split()[0] in response_text
            
            return {
                "language": lang.name,
                "code": lang.code,
                "status": "✅ PASS" if passed else "⚠️ PARTIAL",
                "message": f"Matched: {matches[:3]}" if matches else "Response in English (fallback)",
                "model": model,
                "response_preview": data.get("response", "")[:150],
                "duration_ms": duration,
            }
            
        except Exception as e:
            return {
                "language": lang.name,
                "status": "💥 ERROR",
                "message": str(e),
            }


async def check_backend() -> bool:
    """Check if backend is running."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_BASE.replace('/api/v1', '')}/health")
            return response.status_code == 200
    except:
        return False


async def run_all_language_tests():
    """Run tests for all 11 SA languages."""
    print("\n" + "=" * 80)
    print("🌍 GOGGA 11 SOUTH AFRICAN LANGUAGES TEST")
    print("=" * 80)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    if not await check_backend():
        print("❌ Backend not responding!")
        return
    
    print("✅ Backend healthy\n")
    
    results = []
    
    for i, lang in enumerate(SA_LANGUAGES, 1):
        print(f"[{i:2d}/11] Testing {lang.name} ({lang.code})...")
        print(f"        Prompt: \"{lang.question[:50]}...\"")
        
        result = await test_language(lang)
        results.append(result)
        
        print(f"        {result['status']} - {result.get('message', '')}")
        if result.get('response_preview'):
            preview = result['response_preview'].replace('\n', ' ')[:80]
            print(f"        Response: {preview}...")
        print(f"        Duration: {result.get('duration_ms', 0)}ms")
        print()
        
        # Small delay between requests
        await asyncio.sleep(0.5)
    
    # Summary
    print("=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for r in results if "PASS" in r["status"])
    partial = sum(1 for r in results if "PARTIAL" in r["status"])
    failed = sum(1 for r in results if "ERROR" in r["status"])
    
    print(f"Total Languages: 11")
    print(f"  ✅ Passed: {passed}")
    print(f"  ⚠️ Partial: {partial}")
    print(f"  ❌ Failed: {failed}")
    print()
    
    # Table view
    print("┌─────────────────┬────────┬─────────────────────────────────────────┐")
    print("│ Language        │ Status │ Notes                                   │")
    print("├─────────────────┼────────┼─────────────────────────────────────────┤")
    for r in results:
        lang = r["language"][:15].ljust(15)
        status = "✅" if "PASS" in r["status"] else ("⚠️" if "PARTIAL" in r["status"] else "❌")
        notes = r.get("message", "")[:39].ljust(39)
        print(f"│ {lang} │   {status}   │ {notes} │")
    print("└─────────────────┴────────┴─────────────────────────────────────────┘")
    print()
    
    return results


if __name__ == "__main__":
    asyncio.run(run_all_language_tests())
