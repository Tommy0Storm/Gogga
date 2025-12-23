#!/usr/bin/env python3
"""
GOGGA Document Processing Benchmark
====================================
Tests simple vs complex document processing paths.
Measures latency and throughput for OptiLLM-enhanced document pollination.

Usage:
    python bench_doc.py [--backend URL] [--iterations N] [--verbose]

Examples:
    python bench_doc.py
    python bench_doc.py --backend http://192.168.0.130:8000 --iterations 50
"""

import argparse
import asyncio
import json
import os
import random
import statistics
import string
import time
from dataclasses import dataclass
from typing import Optional

# Try to import httpx, fall back to aiohttp
try:
    import httpx
    USE_HTTPX = True
except ImportError:
    try:
        import aiohttp
        USE_HTTPX = False
    except ImportError:
        print("ERROR: Install httpx or aiohttp: pip install httpx")
        exit(1)


@dataclass
class BenchResult:
    """Result of a single benchmark request."""
    success: bool
    latency_ms: float
    path: str  # "simple" or "complex"
    status_code: int
    error: Optional[str] = None


# Sample document content
SIMPLE_DOC_TEMPLATE = """
This is a simple document for testing purposes.
It contains basic text that should be processed quickly.
Topic: {topic}
Generated at: {timestamp}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
"""

COMPLEX_DOC_TEMPLATE = """
LEGAL CONTRACT AGREEMENT

This Agreement ("Agreement") is entered into as of {date} by and between:

Party A: {party_a}
Party B: {party_b}

WHEREAS, the parties wish to establish terms and conditions for their business relationship;

1. DEFINITIONS AND INTERPRETATIONS
   1.1 "Confidential Information" means any information disclosed by either party...
   1.2 "Intellectual Property" includes patents, trademarks, copyrights...
   1.3 "Force Majeure" refers to circumstances beyond reasonable control...

2. TERMS AND CONDITIONS
   2.1 The parties agree to comply with all applicable laws and regulations...
   2.2 Each party shall maintain appropriate insurance coverage...
   2.3 Disputes shall be resolved through binding arbitration...

3. CONSTITUTIONAL COMPLIANCE
   3.1 This agreement adheres to constitutional requirements...
   3.2 All parties acknowledge their legal rights under applicable law...

4. INDEMNIFICATION
   4.1 Each party shall indemnify and hold harmless the other party...

5. LIMITATION OF LIABILITY
   5.1 Neither party shall be liable for consequential damages...

{additional_clauses}

IN WITNESS WHEREOF, the parties have executed this Agreement.

Signature: _________________________ Date: _________
"""


def generate_simple_doc() -> dict:
    """Generate a simple document payload."""
    topics = ["weather", "cooking", "technology", "travel", "sports"]
    content = SIMPLE_DOC_TEMPLATE.format(
        topic=random.choice(topics),
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
    )
    return {
        "id": f"simple-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
        "text": content,
        "filename": "simple_note.txt",
        "size_bytes": len(content),
        "explicit_complex": False,
        "metadata": {"type": "simple", "generated": True}
    }


def generate_complex_doc() -> dict:
    """Generate a complex document payload (triggers OptiLLM path)."""
    # Generate additional clauses to make it larger
    additional = "\n".join([
        f"{i}. ADDITIONAL CLAUSE {i}\n   {i}.1 Lorem ipsum dolor sit amet..." 
        for i in range(6, 20)
    ])
    
    content = COMPLEX_DOC_TEMPLATE.format(
        date=time.strftime("%Y-%m-%d"),
        party_a="Corporation A Inc.",
        party_b="Corporation B Ltd.",
        additional_clauses=additional
    )
    
    # Pad to exceed COMPLEX_DOC_SIZE_BYTES threshold if needed
    while len(content) < 50000:
        content += "\n" + "".join(random.choices(string.ascii_letters + " ", k=500))
    
    return {
        "id": f"complex-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
        "text": content,
        "filename": "legal_contract.pdf",  # Filename triggers complex path
        "size_bytes": len(content),
        "explicit_complex": False,  # Let the system classify based on content/filename
        "metadata": {"type": "legal", "generated": True}
    }


async def send_request_httpx(
    client: "httpx.AsyncClient",
    url: str,
    payload: dict,
    timeout: float = 120.0
) -> BenchResult:
    """Send request using httpx."""
    t0 = time.perf_counter()
    try:
        response = await client.post(
            f"{url}/api/v1/documents/process",
            json=payload,
            timeout=timeout
        )
        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000
        
        body = response.json() if response.status_code == 200 else {}
        path = body.get("path", "unknown")
        
        return BenchResult(
            success=response.status_code == 200,
            latency_ms=latency_ms,
            path=path,
            status_code=response.status_code,
            error=None if response.status_code == 200 else response.text[:200]
        )
    except Exception as e:
        t1 = time.perf_counter()
        return BenchResult(
            success=False,
            latency_ms=(t1 - t0) * 1000,
            path="error",
            status_code=0,
            error=str(e)[:200]
        )


async def send_request_aiohttp(
    session: "aiohttp.ClientSession",
    url: str,
    payload: dict,
    timeout: float = 120.0
) -> BenchResult:
    """Send request using aiohttp."""
    t0 = time.perf_counter()
    try:
        async with session.post(
            f"{url}/api/v1/documents/process",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=timeout)
        ) as response:
            t1 = time.perf_counter()
            latency_ms = (t1 - t0) * 1000
            
            body = await response.json() if response.status == 200 else {}
            path = body.get("path", "unknown")
            
            return BenchResult(
                success=response.status == 200,
                latency_ms=latency_ms,
                path=path,
                status_code=response.status,
                error=None if response.status == 200 else (await response.text())[:200]
            )
    except Exception as e:
        t1 = time.perf_counter()
        return BenchResult(
            success=False,
            latency_ms=(t1 - t0) * 1000,
            path="error",
            status_code=0,
            error=str(e)[:200]
        )


def print_stats(label: str, results: list[BenchResult]):
    """Print statistics for a set of results."""
    if not results:
        print(f"{label}: No results")
        return
    
    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]
    
    print(f"\n{'='*60}")
    print(f"{label}")
    print(f"{'='*60}")
    print(f"Total requests: {len(results)}")
    print(f"Successful: {len(successful)} ({len(successful)/len(results)*100:.1f}%)")
    print(f"Failed: {len(failed)}")
    
    if successful:
        latencies = [r.latency_ms for r in successful]
        print(f"\nLatency (ms):")
        print(f"  Min:    {min(latencies):.1f}")
        print(f"  Max:    {max(latencies):.1f}")
        print(f"  Mean:   {statistics.mean(latencies):.1f}")
        print(f"  Median: {statistics.median(latencies):.1f}")
        if len(latencies) > 1:
            print(f"  StdDev: {statistics.stdev(latencies):.1f}")
        
        # P95, P99 if enough samples
        if len(latencies) >= 20:
            sorted_lat = sorted(latencies)
            p95_idx = int(len(sorted_lat) * 0.95)
            p99_idx = int(len(sorted_lat) * 0.99)
            print(f"  P95:    {sorted_lat[p95_idx]:.1f}")
            print(f"  P99:    {sorted_lat[p99_idx]:.1f}")
        
        # Throughput
        total_time_s = sum(latencies) / 1000
        print(f"\nThroughput: {len(successful) / (total_time_s / len(successful)):.2f} req/s")
    
    if failed:
        print(f"\nErrors:")
        for r in failed[:5]:
            print(f"  - {r.error}")


async def run_benchmark(
    backend_url: str,
    iterations: int,
    verbose: bool = False
):
    """Run the full benchmark suite."""
    print(f"\n{'#'*60}")
    print(f"# GOGGA Document Processing Benchmark")
    print(f"# Backend: {backend_url}")
    print(f"# Iterations: {iterations} per path")
    print(f"{'#'*60}\n")
    
    simple_results: list[BenchResult] = []
    complex_results: list[BenchResult] = []
    
    if USE_HTTPX:
        async with httpx.AsyncClient(timeout=180.0) as client:
            # Warmup
            print("Warming up...")
            warmup_doc = generate_simple_doc()
            await send_request_httpx(client, backend_url, warmup_doc)
            
            # Simple path benchmark
            print(f"\nRunning SIMPLE path benchmark ({iterations} iterations)...")
            for i in range(iterations):
                doc = generate_simple_doc()
                result = await send_request_httpx(client, backend_url, doc)
                simple_results.append(result)
                if verbose:
                    status = "✓" if result.success else "✗"
                    print(f"  [{i+1}/{iterations}] {status} {result.latency_ms:.0f}ms")
            
            # Complex path benchmark
            print(f"\nRunning COMPLEX path benchmark ({iterations} iterations)...")
            for i in range(iterations):
                doc = generate_complex_doc()
                result = await send_request_httpx(client, backend_url, doc)
                complex_results.append(result)
                if verbose:
                    status = "✓" if result.success else "✗"
                    print(f"  [{i+1}/{iterations}] {status} {result.latency_ms:.0f}ms ({result.path})")
    else:
        async with aiohttp.ClientSession() as session:
            # Warmup
            print("Warming up...")
            warmup_doc = generate_simple_doc()
            await send_request_aiohttp(session, backend_url, warmup_doc)
            
            # Simple path benchmark
            print(f"\nRunning SIMPLE path benchmark ({iterations} iterations)...")
            for i in range(iterations):
                doc = generate_simple_doc()
                result = await send_request_aiohttp(session, backend_url, doc)
                simple_results.append(result)
                if verbose:
                    status = "✓" if result.success else "✗"
                    print(f"  [{i+1}/{iterations}] {status} {result.latency_ms:.0f}ms")
            
            # Complex path benchmark
            print(f"\nRunning COMPLEX path benchmark ({iterations} iterations)...")
            for i in range(iterations):
                doc = generate_complex_doc()
                result = await send_request_aiohttp(session, backend_url, doc)
                complex_results.append(result)
                if verbose:
                    status = "✓" if result.success else "✗"
                    print(f"  [{i+1}/{iterations}] {status} {result.latency_ms:.0f}ms ({result.path})")
    
    # Print results
    print_stats("SIMPLE PATH (Direct/Fast)", simple_results)
    print_stats("COMPLEX PATH (OptiLLM Enhanced)", complex_results)
    
    # Comparison
    simple_success = [r for r in simple_results if r.success]
    complex_success = [r for r in complex_results if r.success]
    
    if simple_success and complex_success:
        simple_mean = statistics.mean([r.latency_ms for r in simple_success])
        complex_mean = statistics.mean([r.latency_ms for r in complex_success])
        overhead = ((complex_mean - simple_mean) / simple_mean) * 100
        
        print(f"\n{'='*60}")
        print(f"COMPARISON")
        print(f"{'='*60}")
        print(f"Simple mean:  {simple_mean:.1f} ms")
        print(f"Complex mean: {complex_mean:.1f} ms")
        print(f"OptiLLM overhead: {overhead:+.1f}%")
        print(f"Complex is {complex_mean/simple_mean:.1f}x slower than simple")
    
    print(f"\n{'#'*60}")
    print("# Benchmark Complete")
    print(f"{'#'*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="GOGGA Document Processing Benchmark"
    )
    parser.add_argument(
        "--backend",
        default=os.getenv("BACKEND_URL", "http://192.168.0.130:8000"),
        help="Backend URL (default: http://192.168.0.130:8000)"
    )
    parser.add_argument(
        "--iterations", "-n",
        type=int,
        default=20,
        help="Number of iterations per path (default: 20)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print progress for each request"
    )
    
    args = parser.parse_args()
    
    asyncio.run(run_benchmark(
        backend_url=args.backend,
        iterations=args.iterations,
        verbose=args.verbose
    ))


if __name__ == "__main__":
    main()
