"""
List available models in Vertex AI Model Garden
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

def list_model_garden():
    """List available Model Garden publishers and models."""
    
    print("🔍 Checking Vertex AI Model Garden")
    print("=" * 60)
    
    access_token = get_access_token()
    print(f"✅ Authenticated\n")
    
    project_id = "general-dev-480621"
    location = "us-central1"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Check for DeepSeek specifically
    print("🔎 Searching for DeepSeek...")
    deepseek_endpoints = [
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models",
        f"https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models",
    ]
    
    for endpoint in deepseek_endpoints:
        try:
            response = requests.get(endpoint, headers=headers, timeout=30)
            print(f"   Endpoint: {endpoint}")
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                models = response.json()
                print(f"   ✅ Found models:")
                print(json.dumps(models, indent=2)[:500])
                return
            else:
                print(f"   Response: {response.text[:200]}\n")
        except Exception as e:
            print(f"   Error: {e}\n")
    
    print("\n" + "-" * 60)
    print("\n💡 DeepSeek Status:")
    print("   ❌ DeepSeek models not found in Model Garden")
    print("\n📋 To deploy DeepSeek-V3:")
    print("   1. Visit: https://console.cloud.google.com/vertex-ai/model-garden?project=general-dev-480621")
    print("   2. Search for 'deepseek'")
    print("   3. Click on DeepSeek-V3 or DeepSeek-V3.2")
    print("   4. Click 'Deploy' and follow the setup")
    print("\n⏱️  Deployment typically takes 10-15 minutes")
    print("\n🔄 Alternative: Use Google's Gemini models (already available)")
    print("   • gemini-1.5-flash (fast, cheap)")
    print("   • gemini-1.5-pro (balanced)")
    print("   • gemini-2.0-flash-exp (experimental, fast)")

def test_gemini():
    """Test if Gemini is available as an alternative."""
    
    print("\n\n🧪 Testing Gemini as Alternative")
    print("=" * 60)
    
    access_token = get_access_token()
    project_id = "general-dev-480621"
    location = "us-central1"
    
    endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/gemini-1.5-flash:generateContent"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": "Explain POPIA section 19 in simple terms."}]
        }]
    }
    
    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            text = result['candidates'][0]['content']['parts'][0]['text']
            print(f"✅ Gemini 1.5 Flash is working!")
            print(f"\nResponse preview:")
            print(f"{text[:300]}...")
            
            # Check SA context
            sa_markers = ["South Africa", "POPIA", "Information Regulator"]
            found = [m for m in sa_markers if m in text]
            if found:
                print(f"\n🇿🇦 SA Context Detected: {', '.join(found)}")
            
            print("\n💡 You can use Gemini while waiting for DeepSeek deployment")
        else:
            print(f"❌ Status: {response.status_code}")
            print(response.text[:200])
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    list_model_garden()
    test_gemini()
