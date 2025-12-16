"""
List all available models in Vertex AI Model Garden
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

def list_all_models():
    """List all available models and publishers."""
    
    print("🔍 Discovering Available Models in Vertex AI")
    print("=" * 60)
    
    access_token = get_access_token()
    project_id = "general-dev-480621"
    location = "us-central1"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Try to list publishers
    publishers_endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers"
    
    print("📋 Attempting to list Model Garden publishers...")
    try:
        response = requests.get(publishers_endpoint, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(json.dumps(data, indent=2))
        else:
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "-" * 60)
    
    # Try common Model Garden publishers
    print("\n🧪 Testing Common Model Garden Publishers:")
    print("-" * 60)
    
    publishers = [
        "google",           # Google models (Gemini, PaLM)
        "meta",            # Llama models
        "anthropic",       # Claude
        "mistralai",       # Mistral
        "deepseek-ai",     # DeepSeek
        "cohere",          # Cohere
        "ai21",            # AI21 Labs
    ]
    
    available_publishers = []
    
    for publisher in publishers:
        endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/{publisher}/models"
        
        try:
            response = requests.get(endpoint, headers=headers, timeout=10)
            
            if response.status_code == 200:
                print(f"✅ {publisher.upper()}: Available")
                available_publishers.append(publisher)
                
                # Try to get model list
                data = response.json()
                if 'models' in data:
                    models = data['models'][:5]  # Show first 5
                    for model in models:
                        model_name = model.get('name', 'Unknown')
                        print(f"   • {model_name.split('/')[-1]}")
            elif response.status_code == 404:
                print(f"❌ {publisher.upper()}: Not available")
            elif response.status_code == 403:
                print(f"⚠️  {publisher.upper()}: Permission denied")
            else:
                print(f"⚠️  {publisher.upper()}: Status {response.status_code}")
                
        except Exception as e:
            print(f"⚠️  {publisher.upper()}: Error - {str(e)[:50]}")
    
    print("\n" + "=" * 60)
    
    if available_publishers:
        print(f"\n✅ Available Publishers: {', '.join(available_publishers)}")
        return available_publishers
    else:
        print("\n❌ No publishers found - Models may need to be accessed differently")
        return []

def test_specific_models():
    """Test specific model endpoints."""
    
    print("\n\n🧪 Testing Specific Model Endpoints")
    print("=" * 60)
    
    access_token = get_access_token()
    project_id = "general-dev-480621"
    location = "us-central1"
    
    # Model endpoints to test
    test_models = [
        # Google models
        ("Gemini 1.5 Flash", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/gemini-1.5-flash:generateContent"),
        ("Gemini 1.5 Pro", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/gemini-1.5-pro:generateContent"),
        ("Gemini 2.0 Flash", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/gemini-2.0-flash-exp:generateContent"),
        
        # Meta models
        ("Qwen 3 235B", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/meta/models/llama-3.3-70b-instruct-maas:generateContent"),
        ("Llama 3.1 405B", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/meta/models/llama-3.1-405b-instruct-maas:generateContent"),
        
        # DeepSeek
        ("DeepSeek V3", f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3:generateContent"),
    ]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": "Hello"}]
        }]
    }
    
    available_models = []
    
    for model_name, endpoint in test_models:
        print(f"\n{model_name}:")
        print(f"  Testing... ", end="", flush=True)
        
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=15)
            
            if response.status_code == 200:
                print(f"✅ AVAILABLE")
                available_models.append(model_name)
                
                # Try to extract response
                try:
                    result = response.json()
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    print(f"  Response: {text[:50]}...")
                except:
                    pass
                    
            elif response.status_code == 404:
                print(f"❌ Not found")
            elif response.status_code == 403:
                print(f"⚠️  Permission denied")
            elif response.status_code == 400:
                print(f"⚠️  Bad request (may need deployment)")
            else:
                print(f"⚠️  Status {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)[:40]}")
    
    print("\n" + "=" * 60)
    
    if available_models:
        print(f"\n✅ AVAILABLE MODELS ({len(available_models)}):")
        for model in available_models:
            print(f"   • {model}")
    else:
        print("\n⚠️  No models responded successfully")
        print("   Models may require:")
        print("   1. Explicit deployment in Model Garden")
        print("   2. Additional IAM permissions")
        print("   3. API enablement")

if __name__ == "__main__":
    publishers = list_all_models()
    test_specific_models()
    
    print("\n\n📝 Next Steps:")
    print("=" * 60)
    print("Visit Model Garden to see all available models:")
    print("https://console.cloud.google.com/vertex-ai/model-garden?project=general-dev-480621")
