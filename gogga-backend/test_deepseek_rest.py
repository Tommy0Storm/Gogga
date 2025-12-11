"""
DeepSeek-V3.2 via Google Vertex AI - Direct REST API Test
Uses Vertex AI endpoint with API key authentication
"""

import requests
import json

def test_deepseek_rest_api():
    """Test DeepSeek via Vertex AI REST API."""
    
    print("🧪 Testing DeepSeek-V3.2 via Vertex AI REST API")
    print("=" * 60)
    
    # Vertex AI endpoint for model garden
    project_id = "general-dev-480621"
    location = "us-central1"
    model_id = "DeepSeek-V3.2"
    
    # Try different endpoint patterns
    endpoints = [
        # Model Garden endpoint
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/{model_id}:predict",
        # Direct prediction endpoint
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/endpoints/deepseek-v3-2:predict",
        # Alternative format
        f"https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/{model_id}:generateContent"
    ]
    
    api_key = "AQ.Ab8RN6KroCuMxSkr9xo_bIfSIq4ZiWvijV1Cdvm-0YR-1jXRmQ"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [{
            "parts": [{
                "text": "Explain POPIA section 19 in simple terms."
            }]
        }]
    }
    
    for i, endpoint in enumerate(endpoints, 1):
        print(f"\n🔗 Attempt {i}: {endpoint[:80]}...")
        
        try:
            response = requests.post(
                endpoint,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ SUCCESS!")
                print(f"   Response: {json.dumps(result, indent=2)[:500]}")
                return
            else:
                print(f"   ❌ Error: {response.text[:200]}")
                
        except Exception as e:
            print(f"   ❌ Exception: {e}")
    
    print("\n" + "=" * 60)
    print("❌ All endpoint attempts failed")
    print("\n💡 The API key format suggests you need to:")
    print("   1. Use gcloud auth instead of API key")
    print("   2. Or deploy DeepSeek as a Vertex AI endpoint first")
    print("   3. Or check if DeepSeek is available in Model Garden")

def test_with_curl():
    """Generate curl command for manual testing."""
    
    print("\n\n🔧 Manual Testing Command:")
    print("=" * 60)
    
    project_id = "general-dev-480621"
    location = "us-central1"
    api_key = "AQ.Ab8RN6KroCuMxSkr9xo_bIfSIq4ZiWvijV1Cdvm-0YR-1jXRmQ"
    
    curl_cmd = f"""
curl -X POST \\
  -H "Authorization: Bearer {api_key}" \\
  -H "Content-Type: application/json" \\
  https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/DeepSeek-V3.2:predict \\
  -d '{{
    "instances": [{{
      "prompt": "Explain POPIA section 19 in simple terms."
    }}]
  }}'
"""
    
    print(curl_cmd)
    
if __name__ == "__main__":
    test_deepseek_rest_api()
    test_with_curl()
