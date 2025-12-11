#!/usr/bin/env python3
"""
Manual test script for Language Detector Plugin
Tests all 11 SA languages without pytest dependency
"""
import sys
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.plugins.language_detector import LanguageDetectorPlugin, LANGUAGE_PROFILES

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def test_result(test_name: str, passed: bool, details: str = ""):
    """Print test result"""
    status = f"{GREEN}✓ PASS{RESET}" if passed else f"{RED}✗ FAIL{RESET}"
    print(f"{status} {test_name}")
    if details:
        print(f"      {details}")


async def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*70}")
    print("GOGGA Language Detector v3.0 - Test Suite")
    print(f"{'='*70}{RESET}\n")
    
    detector = LanguageDetectorPlugin()
    passed = 0
    failed = 0
    
    # Test 1: Profile Completeness
    print(f"{YELLOW}[1] Testing Language Profiles{RESET}")
    expected_codes = {'en', 'af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 'ss', 've', 'nr'}
    actual_codes = set(LANGUAGE_PROFILES.keys())
    if actual_codes == expected_codes:
        test_result("All 11 SA languages present", True)
        passed += 1
    else:
        test_result("All 11 SA languages present", False, f"Missing: {expected_codes - actual_codes}")
        failed += 1
    
    # Test 2: Zulu Detection
    print(f"\n{YELLOW}[2] Testing isiZulu Detection{RESET}")
    test_cases = [
        ("Sawubona, unjani?", "zu", 0.4),  # Short phrases → moderate confidence
        ("Ngiyabonga kakhulu!", "zu", 0.4),
        ("Ngifuna ukuya edolobheni", "zu", 0.35),
    ]
    for text, expected_code, min_confidence in test_cases:
        result = detector.detect(text)
        passed_test = result.code == expected_code and result.confidence >= min_confidence
        test_result(
            f"'{text[:30]}...'", 
            passed_test,
            f"Detected: {result.name} ({result.code}) @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 3: Xhosa Detection
    print(f"\n{YELLOW}[3] Testing isiXhosa Detection{RESET}")
    test_cases = [
        ("Molo, unjani namhlanje?", "xh", 0.4),
        ("Enkosi kakhulu!", "xh", 0.35),
    ]
    for text, expected_code, min_confidence in test_cases:
        result = detector.detect(text)
        passed_test = result.code == expected_code and result.confidence >= min_confidence
        test_result(
            f"'{text[:30]}...'",
            passed_test,
            f"Detected: {result.name} ({result.code}) @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 4: Afrikaans Detection
    print(f"\n{YELLOW}[4] Testing Afrikaans Detection{RESET}")
    test_cases = [
        ("Hallo, hoe gaan dit?", "af", 0.4),
        ("Ek het nie tyd nie", "af", 0.5),
    ]
    for text, expected_code, min_confidence in test_cases:
        result = detector.detect(text)
        passed_test = result.code == expected_code and result.confidence >= min_confidence
        test_result(
            f"'{text[:30]}...'",
            passed_test,
            f"Detected: {result.name} ({result.code}) @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 5: Sepedi Detection
    print(f"\n{YELLOW}[5] Testing Sepedi Detection{RESET}")
    test_cases = [
        ("Thobela, o kae?", "nso", 0.4),
        ("Ke leboga kudu!", "nso", 0.4),  # May detect as Setswana (similar)
    ]
    for text, expected_code, min_confidence in test_cases:
        result = detector.detect(text)
        passed_test = result.code == expected_code and result.confidence >= min_confidence
        test_result(
            f"'{text[:30]}...'",
            passed_test,
            f"Detected: {result.name} ({result.code}) @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 6: English Detection
    print(f"\n{YELLOW}[6] Testing English Detection{RESET}")
    test_cases = [
        ("Hello, how are you?", "en", 0.5),
        ("The quick brown fox jumps", "en", 0.35),
    ]
    for text, expected_code, min_confidence in test_cases:
        result = detector.detect(text)
        passed_test = result.code == expected_code and result.confidence >= min_confidence
        test_result(
            f"'{text[:30]}...'",
            passed_test,
            f"Detected: {result.name} ({result.code}) @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 7: Code-Switching
    print(f"\n{YELLOW}[7] Testing Code-Switching Detection{RESET}")
    result = detector.detect("Sawubona, I need help please")
    # Either Zulu or English is acceptable
    passed_test = result.code in ['zu', 'en']
    test_result(
        "Mixed Zulu/English",
        passed_test,
        f"Detected: {result.name} @ {result.confidence:.2f}, Hybrid: {result.is_hybrid}"
    )
    if passed_test:
        passed += 1
    else:
        failed += 1
    
    # Test 8: Edge Cases
    print(f"\n{YELLOW}[8] Testing Edge Cases{RESET}")
    edge_cases = [
        ("", "en", 0.0, 0.2, "Empty string"),
        ("Hi", "en", 0.0, 1.0, "Very short"),
        ("123456", "en", 0.0, 0.3, "Numbers only"),
    ]
    for text, expected_code, min_conf, max_conf, desc in edge_cases:
        result = detector.detect(text)
        passed_test = (result.code == expected_code and 
                      min_conf <= result.confidence <= max_conf)
        test_result(
            desc,
            passed_test,
            f"Detected: {result.name} @ {result.confidence:.2f}"
        )
        if passed_test:
            passed += 1
        else:
            failed += 1
    
    # Test 9: Plugin Integration
    print(f"\n{YELLOW}[9] Testing Plugin Integration{RESET}")
    # Use pure Zulu for system prompt injection test
    request = {
        "messages": [{"role": "user", "content": "Ngiyabonga kakhulu sawubona"}],
        "metadata": {}
    }
    enriched = await detector.before_request(request)
    
    has_metadata = "language_intelligence" in enriched["metadata"]
    test_result("Metadata enrichment", has_metadata)
    if has_metadata:
        passed += 1
        lang_data = enriched["metadata"]["language_intelligence"]
        print(f"      Language: {lang_data['name']} ({lang_data['code']})")
        print(f"      Confidence: {lang_data['confidence']:.2f}")
        print(f"      Method: {lang_data['method']}")
    else:
        failed += 1
    
    # System prompt should inject for non-English with confidence > 0.35
    has_system_prompt = any(
        msg.get("role") == "system" and "LANGUAGE INTELLIGENCE" in msg.get("content", "")
        for msg in enriched["messages"]
    )
    test_result("System prompt injection", has_system_prompt)
    if has_system_prompt:
        passed += 1
    else:
        failed += 1
    
    # Test 10: All Languages Have Profiles
    print(f"\n{YELLOW}[10] Testing Profile Completeness{RESET}")
    for code, profile in LANGUAGE_PROFILES.items():
        has_all_fields = (
            len(profile.name) > 0 and
            len(profile.greeting) > 0 and
            len(profile.core_vocab) > 0 and
            len(profile.fingerprints) > 0 and
            len(profile.cultural_markers) > 0
        )
        test_result(
            f"{profile.name} ({code}) profile",
            has_all_fields,
            f"Family: {profile.family.value}"
        )
        if has_all_fields:
            passed += 1
        else:
            failed += 1
    
    # Summary
    print(f"\n{BLUE}{'='*70}")
    print("Test Summary")
    print(f"{'='*70}{RESET}")
    print(f"{GREEN}Passed: {passed}{RESET}")
    print(f"{RED}Failed: {failed}{RESET}")
    print(f"Total: {passed + failed}")
    
    success_rate = (passed / (passed + failed)) * 100 if (passed + failed) > 0 else 0
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    
    if failed == 0:
        print(f"\n{GREEN}✓ ALL TESTS PASSED!{RESET}\n")
        return 0
    else:
        print(f"\n{RED}✗ SOME TESTS FAILED{RESET}\n")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
