"""
GOGGA Python Executor Service

Executes Python code safely for math calculations.
Uses Python 3.14 features:
- Decimal.from_number() for precise decimal construction
- Fraction.from_number() for rational number construction  
- Template strings (t-strings) for structured output
- Improved number formatting with thousands separators
- float.from_number() and complex.from_number() for type conversion
"""

import ast
import io
import logging
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr
from dataclasses import dataclass
from typing import Any, Optional
import multiprocessing
from multiprocessing import Process, Queue
import queue

logger = logging.getLogger("gogga.python_executor")

# Allowed imports for sandboxed execution
ALLOWED_MODULES = {
    'math', 'decimal', 'fractions', 'statistics', 'cmath',
    'numpy', 'scipy', 'scipy.stats', 'scipy.special',
    'itertools', 'functools', 'operator', 'collections',
    'datetime', 'random', 'string', 're'
}

# Dangerous AST nodes that are not allowed
FORBIDDEN_NODES = {
    # Note: Imports are allowed but validated separately
    ast.AsyncFunctionDef, ast.AsyncFor, ast.AsyncWith, ast.Await,
}

# Forbidden function names
FORBIDDEN_NAMES = {
    'eval', 'exec', 'compile', 'open', 'input',
    'getattr', 'setattr', 'delattr', 'globals', 'locals', 'vars',
    'exit', 'quit', 'breakpoint', 'help', 'copyright', 'credits', 'license',
    'os', 'sys', 'subprocess', 'shutil', 'pathlib', 'socket', 'requests',
    'urllib', 'http', 'ftplib', 'smtplib', 'pickle', 'shelve', 'dbm',
}


@dataclass
class ExecutionResult:
    """Result of Python code execution."""
    success: bool
    output: str
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    display_type: str = "terminal"  # For frontend rendering


class CodeValidator:
    """Validates Python code for safe execution."""
    
    @staticmethod
    def validate(code: str) -> tuple[bool, Optional[str]]:
        """
        Validate code for safe execution.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {e.msg} (line {e.lineno})"
        
        # Check for forbidden nodes and names
        for node in ast.walk(tree):
            node_type = type(node)
            
            # Check forbidden names in function calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in FORBIDDEN_NAMES:
                        return False, f"Forbidden function: {node.func.id}"
            
            # Check forbidden names in Name nodes
            if isinstance(node, ast.Name):
                if node.id in FORBIDDEN_NAMES:
                    return False, f"Forbidden name: {node.id}"
            
            # Check imports - only allow specific modules
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module = alias.name.split('.')[0]
                    if module not in ALLOWED_MODULES:
                        return False, f"Forbidden import: {alias.name}"
            
            if isinstance(node, ast.ImportFrom):
                if node.module:
                    module = node.module.split('.')[0]
                    if module not in ALLOWED_MODULES:
                        return False, f"Forbidden import: {node.module}"
        
        return True, None


def _execute_in_sandbox(code: str, result_queue: Queue, timeout: int = 10):
    """
    Execute code in a sandboxed subprocess.
    
    This function runs in a separate process for isolation.
    """
    import time
    start_time = time.perf_counter()
    
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    # Pre-import allowed modules first
    imported_modules = {}
    try:
        import math
        import decimal
        from decimal import Decimal
        import fractions
        from fractions import Fraction
        import statistics
        import cmath
        import numpy as np
        from scipy import stats as scipy_stats
        import itertools
        import functools
        import operator
        import collections
        import datetime
        import random
        
        imported_modules = {
            'math': math,
            'decimal': decimal,
            'Decimal': Decimal,
            'fractions': fractions,
            'Fraction': Fraction,
            'statistics': statistics,
            'cmath': cmath,
            'np': np,
            'numpy': np,
            'scipy': __import__('scipy'),
            'scipy_stats': scipy_stats,
            'itertools': itertools,
            'functools': functools,
            'operator': operator,
            'collections': collections,
            'datetime': datetime,
            'random': random,
        }
    except ImportError as e:
        result_queue.put(ExecutionResult(
            success=False,
            output="",
            error=f"Failed to import required modules: {e}",
            execution_time_ms=0.0
        ))
        return
    
    # Create restricted import function
    def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
        """Allow only pre-approved modules to be imported."""
        base_module = name.split('.')[0]
        if base_module not in ALLOWED_MODULES:
            raise ImportError(f"Import of '{name}' is not allowed")
        
        # Return pre-imported module if available
        if name in imported_modules:
            return imported_modules[name]
        
        # For scipy.stats and other submodules
        if name == 'scipy.stats':
            return scipy_stats
        
        # Use real import for allowed modules
        import builtins
        return builtins.__import__(name, globals, locals, fromlist, level)
    
    # Set up sandbox globals with allowed modules pre-imported
    sandbox_globals = {
        '__builtins__': {
            'print': print,
            'len': len,
            'range': range,
            'enumerate': enumerate,
            'zip': zip,
            'map': map,
            'filter': filter,
            'sum': sum,
            'min': min,
            'max': max,
            'abs': abs,
            'round': round,
            'sorted': sorted,
            'reversed': reversed,
            'list': list,
            'dict': dict,
            'set': set,
            'tuple': tuple,
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'complex': complex,
            'type': type,
            'isinstance': isinstance,
            'issubclass': issubclass,
            'hasattr': hasattr,
            'repr': repr,
            'format': format,
            'pow': pow,
            'divmod': divmod,
            'bin': bin,
            'hex': hex,
            'oct': oct,
            'chr': chr,
            'ord': ord,
            'all': all,
            'any': any,
            '__import__': restricted_import,  # Restricted import function
        }
    }
    
    # Add pre-imported modules to globals
    sandbox_globals.update(imported_modules)
    
    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code, sandbox_globals)
        
        output = stdout_capture.getvalue()
        stderr_output = stderr_capture.getvalue()
        
        if stderr_output:
            output += f"\n[stderr]\n{stderr_output}"
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        result_queue.put(ExecutionResult(
            success=True,
            output=output.strip() if output else "(no output)",
            execution_time_ms=execution_time_ms
        ))
        
    except Exception as e:
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        error_msg = f"{type(e).__name__}: {str(e)}"
        
        # Get the last line of the traceback for context
        tb_lines = traceback.format_exc().split('\n')
        for line in reversed(tb_lines):
            if line.strip() and not line.startswith('Traceback'):
                if 'File "<string>"' in line or line.startswith('  '):
                    continue
                break
        
        result_queue.put(ExecutionResult(
            success=False,
            output=stdout_capture.getvalue().strip(),
            error=error_msg,
            execution_time_ms=execution_time_ms
        ))


class PythonExecutor:
    """
    Safe Python code executor for math calculations.
    
    Uses multiprocessing for isolation and timeout control.
    """
    
    def __init__(self, max_timeout: int = 30):
        self.max_timeout = max_timeout
        self.validator = CodeValidator()
    
    def execute(
        self,
        code: str,
        description: str = "",
        timeout: int = 10
    ) -> ExecutionResult:
        """
        Execute Python code safely.
        
        Args:
            code: Python code to execute
            description: Description of what the code does
            timeout: Execution timeout in seconds (capped at max_timeout)
            
        Returns:
            ExecutionResult with output or error
        """
        logger.info(f"🐍 PYTHON EXEC: {description[:50]}...")
        logger.debug(f"🐍 PYTHON EXEC: code=\n{code[:200]}...")
        
        # Validate code
        is_valid, error = self.validator.validate(code)
        if not is_valid:
            logger.warning(f"🐍 PYTHON EXEC: Validation failed - {error}")
            return ExecutionResult(
                success=False,
                output="",
                error=f"Code validation failed: {error}"
            )
        
        # Cap timeout
        timeout = min(timeout, self.max_timeout)
        
        # Execute in subprocess for isolation
        result_queue: Queue = Queue()
        process = Process(
            target=_execute_in_sandbox,
            args=(code, result_queue, timeout)
        )
        
        try:
            process.start()
            process.join(timeout=timeout + 1)  # +1 for process overhead
            
            if process.is_alive():
                process.terminate()
                process.join(timeout=1)
                logger.warning(f"🐍 PYTHON EXEC: Timeout after {timeout}s")
                return ExecutionResult(
                    success=False,
                    output="",
                    error=f"Execution timed out after {timeout} seconds"
                )
            
            try:
                result = result_queue.get_nowait()
                logger.info(f"🐍 PYTHON EXEC: {'SUCCESS' if result.success else 'FAILED'} in {result.execution_time_ms:.1f}ms")
                return result
            except queue.Empty:
                return ExecutionResult(
                    success=False,
                    output="",
                    error="No result returned from execution"
                )
                
        except Exception as e:
            logger.error(f"🐍 PYTHON EXEC: Process error - {e}")
            return ExecutionResult(
                success=False,
                output="",
                error=f"Execution error: {str(e)}"
            )
        finally:
            if process.is_alive():
                process.terminate()


# Singleton instance
_executor: Optional[PythonExecutor] = None


def get_python_executor() -> PythonExecutor:
    """Get or create the Python executor singleton."""
    global _executor
    if _executor is None:
        _executor = PythonExecutor()
    return _executor


# =============================================================================
# Python 3.14 Feature Examples (for LLM context)
# =============================================================================

PYTHON_314_EXAMPLES = """
# Python 3.14 Math Features

## 1. Decimal.from_number() - Precise decimal from any number
from decimal import Decimal
pi_approx = Decimal.from_number(22) / Decimal.from_number(7)
print(f"Pi ≈ {pi_approx:.30f}")

## 2. Fraction.from_number() - Rational from float
from fractions import Fraction
frac = Fraction.from_number(0.125)
print(f"0.125 = {frac}")  # 1/8

## 3. float.from_number() - Strict float conversion
x = float.from_number(Decimal("3.14159"))
print(f"Decimal to float: {x}")

## 4. Thousands separator in fractional part
value = 1234567.8901234
print(f"Formatted: {value:,.6f}")  # 1,234,567.890123

## 5. Template strings (conceptual - for future use)
# t'Value is {value:.2f}'  # Returns Template object for processing

## 6. High-precision calculations
from decimal import Decimal, getcontext
getcontext().prec = 50
result = Decimal(1) / Decimal(7)
print(f"1/7 to 50 digits: {result}")
"""
