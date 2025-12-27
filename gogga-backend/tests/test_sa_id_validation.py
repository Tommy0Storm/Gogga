"""
SA ID Number Validation Tests

Tests the SA-specific Luhn algorithm implementation.
SA uses LEFT-TO-RIGHT doubling (positions 2,4,6,8,10,12) which is 
different from standard Luhn (right-to-left).

Reference: https://medium.com/@ryanneilparker/sa-id-fumble-how-south-africa-managed-to-incorrectly-apply-the-luhn-algorithm-352dd6f10738
"""

import pytest


def validate_sa_id(id_number: str) -> bool:
    """
    Validate SA ID using SA-specific Luhn algorithm.
    
    CRITICAL: SA uses LEFT-TO-RIGHT doubling of even positions (2,4,6,8,10,12).
    This is the OPPOSITE of standard Luhn which uses right-to-left.
    
    Args:
        id_number: 13-digit South African ID number as string
        
    Returns:
        True if valid SA ID, False otherwise
    """
    if len(id_number) != 13 or not id_number.isdigit():
        return False
    
    total = 0
    for i, char in enumerate(id_number):
        digit = int(char)
        # SA Luhn: double EVEN positions (2,4,6,8,10,12) - 0-indexed = 1,3,5,7,9,11
        if (i + 1) % 2 == 0:  # Position 2,4,6,8,10,12 (1-indexed)
            digit *= 2
            if digit > 9:
                digit -= 9  # Equivalent to sum of digits
        total += digit
    return total % 10 == 0


def parse_sa_id(id_number: str) -> dict | None:
    """
    Parse SA ID number into components.
    
    SA ID Structure (13 digits):
    - YYMMDD (6 digits): Date of birth
    - SSSS (4 digits): Gender (0000-4999 = female, 5000-9999 = male)
    - C (1 digit): Citizenship (0 = SA citizen, 1 = permanent resident)
    - A (1 digit): Usually 8 (historically race, now deprecated)
    - Z (1 digit): Check digit (SA-specific Luhn)
    
    Args:
        id_number: 13-digit South African ID number
        
    Returns:
        Dictionary with parsed components or None if invalid
    """
    if not validate_sa_id(id_number):
        return None
    
    year = int(id_number[0:2])
    month = int(id_number[2:4])
    day = int(id_number[4:6])
    gender_code = int(id_number[6:10])
    citizenship = int(id_number[10])
    
    # Determine century (simple heuristic: < 25 = 2000s, >= 25 = 1900s)
    full_year = 2000 + year if year < 25 else 1900 + year
    
    return {
        'birth_date': f'{full_year:04d}-{month:02d}-{day:02d}',
        'gender': 'female' if gender_code < 5000 else 'male',
        'citizen': citizenship == 0,
        'check_digit': int(id_number[12])
    }


class TestSAIDValidation:
    """Tests for SA-specific Luhn algorithm."""
    
    def test_valid_id_from_user_1(self):
        """Test ID 7604195106085 - confirmed valid by user in transcript."""
        assert validate_sa_id('7604195106085') is True
    
    def test_valid_id_from_user_2(self):
        """Test ID 8408150040084 - confirmed valid by user in transcript."""
        assert validate_sa_id('8408150040084') is True
    
    def test_invalid_length_short(self):
        """ID with less than 13 digits should fail."""
        assert validate_sa_id('760419510608') is False
    
    def test_invalid_length_long(self):
        """ID with more than 13 digits should fail."""
        assert validate_sa_id('76041951060850') is False
    
    def test_invalid_non_numeric(self):
        """ID with non-numeric characters should fail."""
        assert validate_sa_id('7604195106O85') is False  # O instead of 0
        assert validate_sa_id('7604195106O8a') is False
    
    def test_invalid_empty(self):
        """Empty string should fail."""
        assert validate_sa_id('') is False
    
    def test_invalid_checksum(self):
        """ID with wrong check digit should fail."""
        # Take valid ID 7604195106085 and change last digit
        assert validate_sa_id('7604195106084') is False
        assert validate_sa_id('7604195106086') is False
    
    def test_wrong_luhn_fails_sa_ids(self):
        """
        Demonstrate that doubling ODD positions INCORRECTLY rejects valid SA IDs.
        This is the exact bug GOGGA was experiencing in the chat transcript.
        
        The AI was doubling positions 1,3,5,7,9,11 (ODD) instead of 2,4,6,8,10,12 (EVEN).
        
        Note: Some IDs may coincidentally pass both algorithms, so we test with
        7604195106085 which definitively fails the wrong algorithm.
        """
        def wrong_luhn(id_number: str) -> bool:
            """WRONG: Doubles ODD positions instead of EVEN."""
            if len(id_number) != 13 or not id_number.isdigit():
                return False
            
            total = 0
            for i, char in enumerate(id_number):
                digit = int(char)
                if (i + 1) % 2 == 1:  # WRONG: ODD positions (1,3,5,7,9,11,13)
                    digit *= 2
                    if digit > 9:
                        digit -= 9
                total += digit
            return total % 10 == 0
        
        # 7604195106085 is a VALID SA ID but fails when using wrong algorithm
        # Wrong algorithm gives sum=43, mod 10=3 (invalid)
        # Correct algorithm gives sum=50, mod 10=0 (valid)
        assert wrong_luhn('7604195106085') is False  # Wrong algorithm says invalid!
        
        # But correct SA-specific Luhn (even positions) validates it
        assert validate_sa_id('7604195106085') is True
        
        # 8408150040084 happens to pass both algorithms by coincidence
        # This is valid - just demonstrates that some IDs work both ways
        assert validate_sa_id('8408150040084') is True


class TestSAIDParsing:
    """Tests for SA ID parsing."""
    
    def test_parse_valid_id(self):
        """Parse valid SA ID into components."""
        result = parse_sa_id('7604195106085')
        assert result is not None
        assert result['birth_date'] == '1976-04-19'
        assert result['gender'] == 'male'  # 5106 >= 5000
        assert result['citizen'] is True   # 0 = SA citizen
        assert result['check_digit'] == 5
    
    def test_parse_female_id(self):
        """Parse female SA ID (gender code < 5000)."""
        result = parse_sa_id('8408150040084')
        assert result is not None
        assert result['birth_date'] == '1984-08-15'
        assert result['gender'] == 'female'  # 0040 < 5000
        assert result['citizen'] is True
    
    def test_parse_invalid_id(self):
        """Invalid ID should return None."""
        assert parse_sa_id('1234567890123') is None
        assert parse_sa_id('invalid') is None


class TestSALuhnAlgorithmDetails:
    """Detailed tests verifying the exact SA Luhn algorithm."""
    
    def test_doubling_positions(self):
        """Verify which positions get doubled in SA Luhn."""
        id_num = '7604195106085'
        
        # Positions that should be doubled (even, 1-indexed): 2, 4, 6, 8, 10, 12
        # In 0-indexed: 1, 3, 5, 7, 9, 11
        doubled_positions = [2, 4, 6, 8, 10, 12]
        
        # Verify by checking the sum calculation
        total = 0
        for i, char in enumerate(id_num):
            pos = i + 1
            digit = int(char)
            if pos in doubled_positions:
                digit = digit * 2
                if digit > 9:
                    digit -= 9
            total += digit
        
        assert total % 10 == 0
    
    def test_doubling_greater_than_9(self):
        """Verify digit summing for doubled values > 9."""
        # When we double a digit and get > 9, we subtract 9
        # This is equivalent to summing the digits: 16 -> 1+6=7, or 16-9=7
        
        examples = [
            (5, 10, 1),   # 5*2=10, 10-9=1 (or 1+0=1)
            (6, 12, 3),   # 6*2=12, 12-9=3 (or 1+2=3)
            (7, 14, 5),   # 7*2=14, 14-9=5 (or 1+4=5)
            (8, 16, 7),   # 8*2=16, 16-9=7 (or 1+6=7)
            (9, 18, 9),   # 9*2=18, 18-9=9 (or 1+8=9)
        ]
        
        for original, doubled, result in examples:
            calculated = doubled if doubled <= 9 else doubled - 9
            assert calculated == result


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
