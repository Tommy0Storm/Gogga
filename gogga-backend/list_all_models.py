"""
List ALL available models in Vertex AI Model Garden
Tests multiple publishers: Google, Anthropic, Meta, Mistral, etc.
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

def test_publisher_models():
    """Test different publishers and their models."""
    
    print("🔍 Scanning Vertex AI Model Garden")
    print("=" * 80)
    
    access_token = get_access_token()
    project_id = "general-dev-480621"
    location = "us-central1"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Major AI publishers in Model Garden
    publishers = [
        "google",           # Gemini models
        "anthropic",        # Claude models
        "meta",             # Llama models
        "mistralai",        # Mistral models
        "cohere",           # Command models
        "deepseek-ai",      # DeepSeek (if available)
        "ai21",             # Jurassic models
        "nvidia",           # NeMo models
    ]
    
    available_models = []
    
    for publisher in publishers:
        print(f"\n📦 Publisher: {publisher}")
        print("-" * 80)
        
        # Try both v1 and v1beta1
        for api_version in ["v1", "v1beta1"]:
            endpoint = f"https://{location}-aiplatform.googleapis.com/{api_version}/projects/{project_id}/locations/{location}/publishers/{publisher}/models"
            
            try:
                response = requests.get(endpoint, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'publisherModels' in data:
                        models = data['publisherModels']
                        print(f"   ✅ Found {len(models)} models ({api_version}):")
                        
                        for model in models[:10]:  # Show first 10
                            model_name = model.get('name', '').split('/')[-1]
                            display_name = model.get('displayName', model_name)
                            version = model.get('versionId', 'latest')
                            
                            print(f"      • {model_name}")
                            if display_name != model_name:
                                print(f"        └─ {display_name}")
                            
                            available_models.append({
                                'publisher': publisher,
                                'model': model_name,
                                'display_name': display_name,
                                'version': version,
                                'api_version': api_version
                            })
                        
                        if len(models) > 10:
                            print(f"      ... and {len(models) - 10} more")
                        
                        break  # Found models, no need to try beta
                        
                elif response.status_code == 404:
                    continue  # Try next version
                else:
                    print(f"   ❌ Error {response.status_code}")
                    
            except Exception as e:
                print(f"   ⚠️  {str(e)[:60]}")
    
    # Summary
    print(f"\n\n{'=' * 80}")
    print(f"📊 SUMMARY: Found {len(available_models)} models")
    print(f"{'=' * 80}\n")
    
    if available_models:
        # Group by publisher
        by_publisher = {}
        for m in available_models:
            pub = m['publisher']
            if pub not in by_publisher:
                by_publisher[pub] = []
            by_publisher[pub].append(m['model'])
        
        for pub, models in sorted(by_publisher.items()):
            print(f"✅ {pub}: {len(models)} models")
            for model in models[:5]:
                print(f"   • {model}")
            if len(models) > 5:
                print(f"   ... +{len(models) - 5} more")
            print()
        
        # Save to file
        with open('available_models.json', 'w') as f:
            json.dump(available_models, f, indent=2)
        
        print(f"💾 Full list saved to: available_models.json")
        
    else:
        print("❌ No models found")
        print("\n💡 Possible reasons:")
        print("   1. Service account needs 'Vertex AI User' role")
        print("   2. Vertex AI API not enabled")
        print("   3. Models need to be explicitly enabled in Model Garden")

if __name__ == "__main__":
    test_publisher_models()
