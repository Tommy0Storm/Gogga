"""
DeepSeek-V3.2 Final Test - Using correct model path
"""

import subprocess
import requests
import json

def get_access_token():
    """Get access token from gcloud."""
    result = subprocess.run(
        ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()

def test_deepseek_v3_2():
    """Test DeepSeek-V3.2 with SA-specific queries."""
    
    print("🧪 Testing DeepSeek-V3.2 via Vertex AI")
    print("=" * 60)
    
    access_token = get_access_token()
    print(f"✅ Authenticated\n")
    
    project_id = "general-dev-480621"
    location = "us-central1"
    model_path = "publishers/deepseek-ai/models/deepseek-v3-2"
    
    endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/{model_path}:generateContent"
    
    print(f"📍 Endpoint: {endpoint}\n")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Test cases - SA-specific legal and practical scenarios
    test_cases = [
        {
            "query": "Explain POPIA section 19 in simple terms for a South African small business owner.",
            "description": "Legal query (POPIA Section 19)",
            "expected_markers": ["POPIA", "Section 19", "personal information", "South Africa"]
        },
        {
            "query": "What are my POPIA obligations if I run a spaza shop in Soweto and collect customer phone numbers for delivery?",
            "description": "Practical SA business scenario",
            "expected_markers": ["POPIA", "consent", "personal information", "spaza"]
        },
        {
            "query": "Calculate: If I buy airtime for R50 and data for R149, with load shedding I need a powerbank for R299. What's my total cost?",
            "description": "SA-specific math with context",
            "expected_markers": ["R", "598", "total"]
        },
        {
            "query": "What's the difference between POPIA and GDPR in terms of data subject rights?",
            "description": "Comparative legal analysis",
            "expected_markers": ["POPIA", "GDPR", "rights"]
        }
    ]
    
    results = []
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{'=' * 60}")
        print(f"📝 Test {i}/{len(test_cases)}: {test['description']}")
        print(f"{'=' * 60}")
        print(f"Query: {test['query']}\n")
        print("-" * 60)
        
        payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": test["query"]}]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.95,
                "maxOutputTokens": 2048
            }
        }
        
        try:
            response = requests.post(
                endpoint,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract response text
                text = result['candidates'][0]['content']['parts'][0]['text']
                
                print(f"✅ Response ({len(text)} chars):")
                print(text)
                print()
                
                # Check for expected markers
                found_markers = [m for m in test['expected_markers'] if m.lower() in text.lower()]
                missing_markers = [m for m in test['expected_markers'] if m.lower() not in text.lower()]
                
                if found_markers:
                    print(f"🎯 Context Found: {', '.join(found_markers)}")
                if missing_markers:
                    print(f"⚠️  Missing: {', '.join(missing_markers)}")
                
                # Token usage
                if 'usageMetadata' in result:
                    meta = result['usageMetadata']
                    print(f"📊 Tokens - Input: {meta.get('promptTokenCount', 'N/A')}, Output: {meta.get('candidatesTokenCount', 'N/A')}, Total: {meta.get('totalTokenCount', 'N/A')}")
                
                results.append({
                    "test": test['description'],
                    "status": "✅ PASS",
                    "markers_found": len(found_markers),
                    "markers_total": len(test['expected_markers']),
                    "response_length": len(text)
                })
                
            else:
                print(f"❌ Error {response.status_code}:")
                print(response.text[:300])
                results.append({
                    "test": test['description'],
                    "status": f"❌ FAIL ({response.status_code})",
                    "error": response.text[:100]
                })
                
        except Exception as e:
            print(f"❌ Exception: {e}")
            results.append({
                "test": test['description'],
                "status": "❌ ERROR",
                "error": str(e)[:100]
            })
    
    # Summary
    print(f"\n\n{'=' * 60}")
    print("📊 TEST SUMMARY")
    print(f"{'=' * 60}")
    
    for r in results:
        print(f"\n{r['status']} {r['test']}")
        if 'markers_found' in r:
            print(f"   Context: {r['markers_found']}/{r['markers_total']} markers found")
            print(f"   Length: {r['response_length']} chars")
    
    passed = sum(1 for r in results if '✅' in r['status'])
    print(f"\n{'=' * 60}")
    print(f"Results: {passed}/{len(results)} tests passed")
    print(f"{'=' * 60}")
    
    if passed == len(results):
        print("\n🎉 DeepSeek-V3.2 is READY for GOGGA integration!")
        print("\n📋 Next Steps:")
        print("   1. Update gogga-backend/app/core/router.py")
        print("   2. Add DeepSeek provider to ai_service.py")
        print("   3. Update tier configurations")
        print("   4. Test with full GOGGA stack")
    else:
        print("\n⚠️  Some tests failed. Review errors above.")

if __name__ == "__main__":
    test_deepseek_v3_2()
