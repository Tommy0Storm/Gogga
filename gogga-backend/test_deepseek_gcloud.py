"""
DeepSeek-V3.2 via Google Vertex AI - Using gcloud authentication
Tests the model with POPIA Section 19 query (SA-specific legal content)
"""

import google.auth
import google.auth.transport.requests
import requests
import json

def get_access_token():
    """Get OAuth2 access token from gcloud credentials."""
    try:
        credentials, project = google.auth.default()
        auth_req = google.auth.transport.requests.Request()
        credentials.refresh(auth_req)
        return credentials.token, project
    except Exception as e:
        print(f"❌ Failed to get credentials: {e}")
        print("\n💡 Run this first:")
        print("   gcloud auth application-default login")
        print("   gcloud config set project general-dev-480621")
        return None, None

def test_deepseek_vertex():
    """Test DeepSeek-V3.2 model via Vertex AI with SA legal query."""
    
    print("🧪 Testing DeepSeek-V3.2 via Google Vertex AI (gcloud auth)")
    print("=" * 60)
    
    # Get access token
    access_token, project = get_access_token()
    if not access_token:
        return
    
    print(f"✅ Authenticated with project: {project or 'general-dev-480621'}")
    
    # Use provided project or detected one
    project_id = "general-dev-480621"
    location = "us-central1"
    
    # Test queries - SA-specific legal content
    test_cases = [
        {
            "query": "Explain POPIA section 19 in simple terms.",
            "description": "Legal query (POPIA compliance)"
        },
        {
            "query": "What are the main differences between POPIA and GDPR?",
            "description": "Comparative legal analysis"
        },
        {
            "query": "If I run a spaza shop in Soweto and collect customer phone numbers, what are my POPIA obligations?",
            "description": "Practical SA business scenario"
        }
    ]
    
    # Try different endpoint formats
    endpoint_templates = [
        # Model Garden - generateContent
        "https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3:generateContent",
        # Model Garden - predict
        "https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3:predict",
        # Beta endpoint
        "https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project}/locations/{location}/publishers/deepseek-ai/models/deepseek-v3:generateContent",
        # Alternative model name
        "https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/deepseek-ai/models/DeepSeek-V3.2:generateContent",
    ]
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}: {test['description']}")
        print(f"Query: {test['query']}")
        print("-" * 60)
        
        # Try each endpoint until one works
        for endpoint_template in endpoint_templates:
            endpoint = endpoint_template.format(
                location=location,
                project=project_id
            )
            
            # Try generateContent format
            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{
                        "text": test["query"]
                    }]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.95,
                    "maxOutputTokens": 1024
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
                    try:
                        response_text = result['candidates'][0]['content']['parts'][0]['text']
                    except (KeyError, IndexError):
                        response_text = json.dumps(result, indent=2)
                    
                    print(f"✅ Response received ({len(response_text)} chars):")
                    print(response_text[:500] + "..." if len(response_text) > 500 else response_text)
                    
                    # Check for SA-specific context
                    sa_markers = ["South Africa", "POPIA", "Information Regulator", "ZAR", "Section 19"]
                    found_markers = [m for m in sa_markers if m in response_text]
                    
                    if found_markers:
                        print(f"🇿🇦 SA Context Detected: {', '.join(found_markers)}")
                    
                    # Check metadata
                    if 'usageMetadata' in result:
                        meta = result['usageMetadata']
                        print(f"📊 Tokens - Input: {meta.get('promptTokenCount', 'N/A')}, Output: {meta.get('candidatesTokenCount', 'N/A')}")
                    
                    # Success - break out of endpoint loop
                    break
                    
                elif response.status_code == 404:
                    # Try next endpoint
                    continue
                else:
                    print(f"❌ Error {response.status_code}: {response.text[:200]}")
                    
            except Exception as e:
                print(f"⚠️  Endpoint failed: {str(e)[:100]}")
                continue
        else:
            # All endpoints failed
            print(f"❌ All endpoints failed for test {i}")
            print("💡 DeepSeek might not be deployed in Model Garden yet")
    
    print("\n" + "=" * 60)
    print("🏁 Testing complete")

def check_model_availability():
    """Check if DeepSeek is available in Vertex AI Model Garden."""
    
    print("\n🔍 Checking Model Garden Availability")
    print("=" * 60)
    
    access_token, _ = get_access_token()
    if not access_token:
        return
    
    project_id = "general-dev-480621"
    location = "us-central1"
    
    # List publishers endpoint
    endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        
        if response.status_code == 200:
            publishers = response.json()
            print(f"✅ Available publishers: {json.dumps(publishers, indent=2)[:500]}")
        else:
            print(f"⚠️  Could not list publishers: {response.status_code}")
            print(f"   {response.text[:200]}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n💡 Manual check:")
    print(f"   Visit: https://console.cloud.google.com/vertex-ai/publishers/deepseek-ai/model-garden/deepseek-v3?project={project_id}")

if __name__ == "__main__":
    print("🚀 Starting DeepSeek-V3.2 Vertex AI Tests (gcloud auth)")
    print("Project: general-dev-480621")
    print("Location: us-central1")
    print()
    
    test_deepseek_vertex()
    check_model_availability()
