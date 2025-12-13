"""
Tests for the Python Executor service.

Tests Python 3.14 features:
- Decimal.from_number()
- Fraction.from_number()
- Sandboxed execution
- Security validation
"""

import pytest
from app.services.python_executor import (
    get_python_executor,
    CodeValidator,
    ALLOWED_MODULES,
    FORBIDDEN_NAMES
)


class TestCodeValidator:
    """Tests for the CodeValidator class."""
    
    def test_valid_simple_code(self):
        """Test that simple valid code passes validation."""
        is_valid, error = CodeValidator.validate("print(2 + 2)")
        assert is_valid is True
        assert error is None
    
    def test_valid_math_imports(self):
        """Test that allowed imports pass validation."""
        code = """
from decimal import Decimal
from fractions import Fraction
import math
result = Decimal(10) + Decimal(20)
print(result)
"""
        is_valid, error = CodeValidator.validate(code)
        assert is_valid is True
        assert error is None
    
    def test_forbidden_os_import(self):
        """Test that os import is rejected."""
        is_valid, error = CodeValidator.validate("import os")
        assert is_valid is False
        assert "Forbidden import" in error
    
    def test_forbidden_subprocess_import(self):
        """Test that subprocess import is rejected."""
        is_valid, error = CodeValidator.validate("import subprocess")
        assert is_valid is False
        assert "Forbidden import" in error
    
    def test_forbidden_eval_function(self):
        """Test that eval() is rejected."""
        is_valid, error = CodeValidator.validate("result = eval('2 + 2')")
        assert is_valid is False
        assert "Forbidden" in error
    
    def test_forbidden_exec_function(self):
        """Test that exec() is rejected."""
        is_valid, error = CodeValidator.validate("exec('print(1)')")
        assert is_valid is False
        assert "Forbidden" in error
    
    def test_forbidden_open_function(self):
        """Test that open() is rejected."""
        is_valid, error = CodeValidator.validate("f = open('/etc/passwd')")
        assert is_valid is False
        assert "Forbidden" in error
    
    def test_syntax_error_detection(self):
        """Test that syntax errors are caught."""
        is_valid, error = CodeValidator.validate("if True\n  print('bad')")
        assert is_valid is False
        assert "Syntax error" in error


class TestPythonExecutor:
    """Tests for the PythonExecutor class."""
    
    @pytest.fixture
    def executor(self):
        return get_python_executor()
    
    def test_basic_arithmetic(self, executor):
        """Test basic math operations."""
        result = executor.execute("print(2 + 2)", "Basic addition")
        assert result.success is True
        assert result.output.strip() == "4"
        assert result.error is None
    
    def test_decimal_from_number(self, executor):
        """Test Python 3.14 Decimal.from_number() feature."""
        code = """
from decimal import Decimal
result = Decimal.from_number(0.1) + Decimal.from_number(0.2)
print(f"Result: {result}")
"""
        result = executor.execute(code, "Decimal.from_number test")
        assert result.success is True
        assert "Result:" in result.output
    
    def test_fraction_from_number(self, executor):
        """Test Python 3.14 Fraction.from_number() feature."""
        code = """
from fractions import Fraction
f = Fraction.from_number(0.75)
print(f"0.75 as fraction: {f}")
"""
        result = executor.execute(code, "Fraction.from_number test")
        assert result.success is True
        assert "3/4" in result.output
    
    def test_math_library(self, executor):
        """Test math library usage."""
        code = """
import math
print(f"Pi: {math.pi:.4f}")
print(f"sqrt(2): {math.sqrt(2):.4f}")
"""
        result = executor.execute(code, "Math library test")
        assert result.success is True
        assert "Pi: 3.141" in result.output  # Allow for rounding differences
        assert "1.4142" in result.output
    
    def test_statistics_library(self, executor):
        """Test statistics library usage."""
        code = """
import statistics
data = [1, 2, 3, 4, 5]
print(f"Mean: {statistics.mean(data)}")
print(f"Stdev: {statistics.stdev(data):.4f}")
"""
        result = executor.execute(code, "Statistics test")
        assert result.success is True
        assert "Mean: 3" in result.output
    
    def test_numpy_available(self, executor):
        """Test numpy is available."""
        code = """
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"Mean: {np.mean(arr)}")
print(f"Sum: {np.sum(arr)}")
"""
        result = executor.execute(code, "NumPy test")
        assert result.success is True
        assert "Mean: 3.0" in result.output
        assert "Sum: 15" in result.output
    
    def test_scipy_available(self, executor):
        """Test scipy.stats is available."""
        code = """
from scipy import stats
data = [1, 2, 3, 4, 5]
mean, var = stats.describe(data).mean, stats.describe(data).variance
print(f"Mean: {mean}")
"""
        result = executor.execute(code, "SciPy test")
        assert result.success is True
        assert "Mean: 3.0" in result.output
    
    def test_forbidden_import_blocked(self, executor):
        """Test that forbidden imports are blocked."""
        result = executor.execute("import os; os.system('ls')", "Dangerous")
        assert result.success is False
        assert "Forbidden import" in result.error
    
    def test_forbidden_open_blocked(self, executor):
        """Test that file operations are blocked."""
        result = executor.execute("f = open('/etc/passwd')", "File access")
        assert result.success is False
        assert "Forbidden" in result.error
    
    def test_timeout_enforced(self, executor):
        """Test that infinite loops are terminated."""
        code = "while True: pass"
        result = executor.execute(code, "Infinite loop", timeout=2)
        assert result.success is False
        assert "timeout" in result.error.lower() or "killed" in result.error.lower() or "time" in result.error.lower()
    
    def test_display_type_terminal(self, executor):
        """Test that display_type is set to terminal."""
        result = executor.execute("print('hello')", "Display type test")
        assert result.display_type == "terminal"
    
    def test_execution_time_recorded(self, executor):
        """Test that execution time is recorded."""
        result = executor.execute("print('hello')", "Timing test")
        assert result.success is True
        assert result.execution_time_ms > 0


class TestAllowedModules:
    """Tests for allowed modules configuration."""
    
    def test_required_modules_present(self):
        """Test that essential modules are in ALLOWED_MODULES."""
        required = ['math', 'decimal', 'fractions', 'statistics', 'numpy', 'scipy']
        for module in required:
            assert module in ALLOWED_MODULES, f"{module} should be allowed"
    
    def test_dangerous_modules_absent(self):
        """Test that dangerous modules are not in ALLOWED_MODULES."""
        dangerous = ['os', 'sys', 'subprocess', 'socket', 'pickle', 'shutil']
        for module in dangerous:
            assert module not in ALLOWED_MODULES, f"{module} should not be allowed"


class TestForbiddenNames:
    """Tests for forbidden names configuration."""
    
    def test_dangerous_builtins_forbidden(self):
        """Test that dangerous builtins are forbidden."""
        dangerous = ['eval', 'exec', 'compile', 'open', 'input']
        for name in dangerous:
            assert name in FORBIDDEN_NAMES, f"{name} should be forbidden"
    
    def test_system_access_forbidden(self):
        """Test that system access names are forbidden."""
        system_names = ['os', 'sys', 'subprocess', 'socket']
        for name in system_names:
            assert name in FORBIDDEN_NAMES, f"{name} should be forbidden"
