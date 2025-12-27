# SA ID Validation - Luhn Algorithm Quirk

## Summary

South African ID numbers use a **unique variant** of the Luhn algorithm that differs from the global standard.

## The Issue (Dec 2025)

GOGGA was incorrectly rejecting valid SA IDs because it was using the wrong Luhn implementation:
- **Wrong**: Doubling ODD positions (1,3,5,7,9,11)
- **Correct**: Doubling EVEN positions (2,4,6,8,10,12)

## SA ID Structure (13 digits)

| Positions | Description |
|-----------|-------------|
| 1-6 | Date of birth (YYMMDD) |
| 7-10 | Gender code (0000-4999 = female, 5000-9999 = male) |
| 11 | Citizenship (0 = SA citizen, 1 = permanent resident) |
| 12 | Usually 8 (historically race, now deprecated) |
| 13 | Check digit (SA-specific Luhn) |

## Correct Algorithm

```python
def validate_sa_id(id_number: str) -> bool:
    """Validate SA ID using SA-specific Luhn (left-to-right, double EVEN positions)."""
    if len(id_number) != 13 or not id_number.isdigit():
        return False
    
    total = 0
    for i, char in enumerate(id_number):
        digit = int(char)
        # SA Luhn: double EVEN positions (2,4,6,8,10,12) - 0-indexed = 1,3,5,7,9,11
        if (i + 1) % 2 == 0:  # Position 2,4,6,8,10,12 (1-indexed)
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0
```

## Test IDs

| ID | Valid | Notes |
|----|-------|-------|
| 7604195106085 | ✅ Yes | Only passes correct algorithm |
| 8408150040084 | ✅ Yes | Passes both by coincidence |
| 7604195106084 | ❌ No | Wrong check digit |

## Files Changed

| File | Change |
|------|--------|
| `gogga-frontend/src/app/ChatClient.tsx` | Updated SA ID Validator button prompt |
| `gogga-backend/app/prompts.py` | Added SA TECHNICAL EXPERTISE section |
| `gogga-backend/tests/test_sa_id_validation.py` | New test file (13 tests) |
| `TESTS/sa-id-validation-tests.md` | Test plan documentation |

## Reference

- Medium article: https://medium.com/@ryanneilparker/sa-id-fumble-how-south-africa-managed-to-incorrectly-apply-the-luhn-algorithm-352dd6f10738
- Chat transcript: Dec 27, 2025 - User IDs 7604195106085 and 8408150040084 were incorrectly rejected

## Key Insight

The direction (left-to-right vs right-to-left) doesn't matter for 13-digit IDs because:
- 13 is odd, so reversing swaps odd/even positions
- The critical factor is **WHICH positions get doubled** (even: 2,4,6,8,10,12)

Standard Luhn libraries will work correctly for SA IDs IF they double every 2nd digit starting from position 2 (not position 1).
