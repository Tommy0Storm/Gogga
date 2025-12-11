"""
Vertex AI Model Test - Using Google Cloud AI Platform SDK
Properly initialized with regional endpoints
"""

import os
from google.cloud import aiplatform
from google.cloud.aiplatform_v1 import PublisherModelServiceClient
from google.api_core.client_options import ClientOptions

# Set credentials
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/home/ubuntu/Dev-Projects/Gogga/gogga-backend/vertex-ai-key.json'

PROJECT_ID = 'general-dev-480621'
REGION = 'us-central1'

print("🔧 Initializing Vertex AI Client")
print("=" * 60)
print(f"Project: {PROJECT_ID}")
print(f"Region: {REGION}")
print()

# Initialize Vertex AI
try:
    aiplatform.init(project=PROJECT_ID, location=REGION)
    print("✅ Vertex AI initialized")
except Exception as e:
    print(f"❌ Initialization failed: {e}")
    exit(1)

# Create client with regional endpoint
try:
    client_options = ClientOptions(api_endpoint=f"{REGION}-aiplatform.googleapis.com")
    publisher_client = PublisherModelServiceClient(client_options=client_options)
    print(f"✅ Publisher client created with endpoint: {REGION}-aiplatform.googleapis.com")
except Exception as e:
    print(f"❌ Client creation failed: {e}")
    exit(1)

print()
print("=" * 60)
print("🔍 Listing Publisher Models")
print("=" * 60)

# Try to list models from different publishers
publishers = ["google", "anthropic", "meta", "mistralai", "deepseek-ai"]

for publisher in publishers:
    print(f"\n📦 Publisher: {publisher}")
    print("-" * 60)
    
    try:
        # Request to list models
        parent = f"projects/{PROJECT_ID}/locations/{REGION}/publishers/{publisher}"
        
        # List models
        request = aiplatform_v1.ListModelsRequest(parent=parent)
        models = publisher_client.list_models(request=request)
        
        model_count = 0
        for model in models:
            model_count += 1
            model_id = model.name.split('/')[-1]
            print(f"   • {model_id}")
            
            if model_count >= 5:  # Show first 5
                break
        
        if model_count == 0:
            print(f"   ⚠️  No models found")
        elif model_count >= 5:
            print(f"   ... (showing first 5)")
            
    except Exception as e:
        error_msg = str(e)
        if "404" in error_msg or "not found" in error_msg.lower():
            print(f"   ⚠️  Publisher not available")
        elif "403" in error_msg or "permission" in error_msg.lower():
            print(f"   ❌ Permission denied - check IAM roles")
        else:
            print(f"   ❌ Error: {error_msg[:100]}")

print("\n\n" + "=" * 60)
print("📝 Summary")
print("=" * 60)
print()
print("If you see permission errors:")
print("  1. Run: gcloud auth login")
print("  2. Execute the IAM commands from setup_iam_permissions.sh")
print("  3. Wait 1-2 minutes for propagation")
print("  4. Run this script again")
print()
print("If publisher models are not available:")
print("  • Some publishers may not be onboarded to Model Garden yet")
print("  • DeepSeek may require special access or deployment")
print("  • Google and Anthropic models are usually available")
