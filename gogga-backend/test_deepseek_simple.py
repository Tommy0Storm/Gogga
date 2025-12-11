"""
DeepSeek-V3.2 via Vertex AI - Direct API Test with Access Token
"""

import subprocess
import requests
import json

def get_access_token():
    """Get access token from gcloud."""
    try:
        result = subprocess.run(
            ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"❌ Failed to get access token: {e}")
        return None

def test_deepseek():
    """Test DeepSeek-V3.2 via Vertex AI."""
    
    print("🧪 Testing DeepSeek-V3.2 via Vertex AI (Direct API)")
    print("=" * 60)
    
    # Get access token
    access_token = get_access_token()
    if not access_token:
        return
    
    print(f"✅ Got access token: {access_token[:20]}...")
    
    project_id = "general-dev-480621"
    location = "us-central1"
    
    # Test POPIA query
    query = "Explain POPIA section 19 in simple terms."
    
    print(f"\n📝 Query: {query}")
    print("-" * 60)
    
    # Try different endpoint patterns for DeepSeek
    endpoints = [
        # Model Garden endpoint (most likely)
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3:generateContent",
        # Alternative model name
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/DeepSeek-V3:generateContent",
        # V3.2 variant
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3.2:generateContent",
    ]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": query}]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "maxOutputTokens": 1024
        }
    }
    
    for i, endpoint in enumerate(endpoints, 1):
        print(f"\n🔗 Attempt {i}: Testing endpoint...")
        print(f"   {endpoint[:100]}...")
        
        try:
            response = requests.post(
                endpoint,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract text
                try:
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    print(f"\n   ✅ SUCCESS! Response received:")
                    print(f"   {'-' * 56}")
                    print(f"   {text[:400]}...")
                    
                    # Check SA context
                    sa_markers = ["South Africa", "POPIA", "Information Regulator", "Section 19"]
                    found = [m for m in sa_markers if m in text]
                    if found:
                        print(f"\n   🇿🇦 SA Context: {', '.join(found)}")
                    
                    # Check metadata
                    if 'usageMetadata' in result:
                        meta = result['usageMetadata']
                        print(f"   📊 Tokens - Input: {meta.get('promptTokenCount')}, Output: {meta.get('candidatesTokenCount')}")
                    
                    print("\n" + "=" * 60)
                    print("✅ DeepSeek-V3.2 is working via Vertex AI!")
                    print(f"✅ Endpoint: {endpoint}")
                    return True
                    
                except (KeyError, IndexError) as e:
                    print(f"   ⚠️  Unexpected response format: {e}")
                    print(f"   {json.dumps(result, indent=2)[:300]}")
                    
            elif response.status_code == 404:
                print(f"   ❌ Model not found at this endpoint")
            elif response.status_code == 403:
                print(f"   ❌ Permission denied - service account may need access")
            else:
                error_text = response.text[:200]
                print(f"   ❌ Error: {error_text}")
                
        except Exception as e:
            print(f"   ❌ Request failed: {str(e)[:100]}")
    
    print("\n" + "=" * 60)
    print("❌ DeepSeek not available at any tested endpoint")
    print("\n💡 Next steps:")
    print("   1. Check Model Garden: https://console.cloud.google.com/vertex-ai/model-garden?project=general-dev-480621")
    print("   2. Search for 'deepseek' and deploy if needed")
    print("   3. Check service account permissions for Vertex AI")

if __name__ == "__main__":
    test_deepseek()
