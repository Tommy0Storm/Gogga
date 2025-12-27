# SA ID Validation Fix - Test Plan

## Overview

This test plan covers the fix for the SA ID validation algorithm issue discovered in the GOGGA chat transcript from Dec 27, 2025.

**Issue**: GOGGA was using the wrong Luhn algorithm implementation, doubling ODD positions (1,3,5,7,9,11) instead of EVEN positions (2,4,6,8,10,12).

**Reference**: https://medium.com/@ryanneilparker/sa-id-fumble-how-south-africa-managed-to-incorrectly-apply-the-luhn-algorithm-352dd6f10738

## Changes Made

### 1. ChatClient.tsx (Frontend)
- Updated "SA ID Validator" quick prompt button
- Old prompt: "Write a Python function to validate SA ID numbers"
- New prompt: "Write a Python function to validate SA ID numbers using the correct SA Luhn algorithm (left-to-right, double positions 2,4,6,8,10,12). Test with 7604195106085."
- Updated description: "Python code with SA-specific Luhn"

### 2. prompts.py (Backend)
- Added "SA TECHNICAL EXPERTISE - ID VALIDATION" section
- Documents correct algorithm with example Python code
- Includes test IDs: 7604195106085, 8408150040084

### 3. test_sa_id_validation.py (Backend Tests)
- New test file with 13 tests covering:
  - Valid ID validation (user-provided IDs from transcript)
  - Invalid format handling (length, non-numeric)
  - Checksum verification
  - Algorithm correctness demonstration
  - ID parsing (DOB, gender, citizenship)

## Test Cases

### Manual Testing (Chat Interface)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1 | Quick prompt button | Click "SA ID Validator" in empty chat | Input field populated with detailed SA Luhn prompt |
| 2 | Generate correct code | Send the prompt and wait for response | AI returns Python code that uses EVEN positions (2,4,6,8,10,12) |
| 3 | Validate 7604195106085 | Run generated code with this ID | Returns True/Valid |
| 4 | Validate 8408150040084 | Run generated code with this ID | Returns True/Valid |
| 5 | Reject invalid ID | Run generated code with 7604195106084 (wrong check digit) | Returns False/Invalid |

### Automated Testing (pytest)

```bash
cd gogga-backend
source .venv/bin/activate
pytest tests/test_sa_id_validation.py -v
```

| Test | Description | Status |
|------|-------------|--------|
| test_valid_id_from_user_1 | 7604195106085 validates | ✅ PASS |
| test_valid_id_from_user_2 | 8408150040084 validates | ✅ PASS |
| test_invalid_length_short | 12-digit ID rejected | ✅ PASS |
| test_invalid_length_long | 14-digit ID rejected | ✅ PASS |
| test_invalid_non_numeric | Non-numeric characters rejected | ✅ PASS |
| test_invalid_empty | Empty string rejected | ✅ PASS |
| test_invalid_checksum | Wrong check digit rejected | ✅ PASS |
| test_wrong_luhn_fails_sa_ids | Demonstrates ODD position bug | ✅ PASS |
| test_parse_valid_id | Parses DOB, gender, citizenship | ✅ PASS |
| test_parse_female_id | Parses female ID correctly | ✅ PASS |
| test_parse_invalid_id | Invalid ID returns None | ✅ PASS |
| test_doubling_positions | Verifies EVEN positions doubled | ✅ PASS |
| test_doubling_greater_than_9 | Verifies digit summing | ✅ PASS |

## Algorithm Verification

### Correct SA Luhn Algorithm
```
Position:  1   2   3   4   5   6   7   8   9  10  11  12  13
ID:        7   6   0   4   1   9   5   1   0   6   0   8   5
Double?    N   Y   N   Y   N   Y   N   Y   N   Y   N   Y   N
After:     7   3   0   8   1   9   5   2   0   3   0   7   5
Sum: 50 (mod 10 = 0) → VALID
```

### Wrong Algorithm (what GOGGA was doing)
```
Position:  1   2   3   4   5   6   7   8   9  10  11  12  13
ID:        7   6   0   4   1   9   5   1   0   6   0   8   5
Double?    Y   N   Y   N   Y   N   Y   N   Y   N   Y   N   Y
After:     5   6   0   4   2   9   1   1   0   6   0   8   1
Sum: 43 (mod 10 = 3) → INVALID ❌
```

## Acceptance Criteria

- [ ] "SA ID Validator" button shows updated text in UI
- [ ] Clicking button populates input with SA-specific Luhn prompt
- [ ] AI generates code that doubles EVEN positions, not ODD
- [ ] IDs 7604195106085 and 8408150040084 validate as True
- [ ] All 13 automated tests pass

## Notes

- Some SA IDs coincidentally pass both the correct and wrong algorithm (e.g., 8408150040084 passes both)
- The test specifically uses 7604195106085 which ONLY passes the correct algorithm
- The Medium article notes that SA's implementation is unique - not a "fumble" but a deliberate difference

## Date: December 27, 2025
## Author: GitHub Copilot (Chat Interface Auditor)
