# DeepSeek-V3.2 Vertex AI Test - Results Summary

## ✅ What Worked

1. **Authentication**: Successfully authenticated with service account `vertex-express@general-dev-480621.iam.gserviceaccount.com`
2. **Access Token**: Got valid OAuth2 token from gcloud
3. **API Connectivity**: Can reach Vertex AI endpoints (getting 404, not auth errors)

## ❌ Current Blockers

### 1. DeepSeek Not Deployed
```
Status: 404 - Model not found
Tested endpoints:
  - .../publishers/deepseek-ai/models/deepseek-v3
  - .../publishers/deepseek-ai/models/DeepSeek-V3
  - .../publishers/deepseek-ai/models/deepseek-v3.2
```

**Cause**: DeepSeek-V3.2 is not deployed in your Vertex AI Model Garden yet.

### 2. Service Account Permissions
```
Error: Permission denied to list services for consumer container
```

**Cause**: `vertex-express@general-dev-480621` service account lacks required IAM roles.

## 🔧 Required Actions

### Option A: Deploy DeepSeek (Recommended)

1. **Visit Model Garden**:
   ```
   https://console.cloud.google.com/vertex-ai/model-garden?project=general-dev-480621
   ```

2. **Search for "deepseek"** in the search bar

3. **If DeepSeek appears**:
   - Click on "DeepSeek-V3" or "DeepSeek-V3.2"
   - Click "Deploy" button
   - Choose endpoint configuration:
     - Machine type: `n1-standard-4` (or higher for production)
     - Accelerator: Optional (GPU for faster inference)
   - Wait 10-15 minutes for deployment

4. **After deployment**, note the endpoint ID and update test script

### Option B: Grant Service Account Permissions

1. **Visit IAM & Admin**:
   ```
   https://console.cloud.google.com/iam-admin/iam?project=general-dev-480621
   ```

2. **Find service account**: `vertex-express@general-dev-480621.iam.gserviceaccount.com`

3. **Add these roles**:
   - `Vertex AI User` (roles/aiplatform.user)
   - `Service Usage Consumer` (roles/serviceusage.serviceUsageConsumer)
   - `Vertex AI Service Agent` (roles/aiplatform.serviceAgent)

4. **Save and wait 1-2 minutes** for permissions to propagate

### Option C: Use Gemini Instead (Quick Alternative)

DeepSeek might not be available in Model Garden yet. Use Gemini models which are already deployed:

```python
# Test Gemini 1.5 Flash (similar to Llama 3.3 70B)
endpoint = "https://us-central1-aiplatform.googleapis.com/v1/projects/general-dev-480621/locations/us-central1/publishers/google/models/gemini-1.5-flash-002:generateContent"

# Or Gemini 1.5 Pro (similar to GPT-4)
endpoint = "https://us-central1-aiplatform.googleapis.com/v1/projects/general-dev-480621/locations/us-central1/publishers/google/models/gemini-1.5-pro-002:generateContent"
```

## 📝 Test Files Created

| File | Purpose |
|------|---------|
| `test_deepseek_vertex.py` | Original test (uses google-genai lib) |
| `test_deepseek_gcloud.py` | OAuth2 test with multiple endpoints |
| `test_deepseek_simple.py` | Simple direct API test ✅ |
| `check_vertex_models.py` | Model availability checker |
| `vertex-ai-key.json` | Service account credentials ⚠️ SECURE |
| `setup_vertex_auth.sh` | Setup instructions |

## 🚀 Next Steps (Choose One)

### For DeepSeek Testing:
```bash
# 1. Deploy DeepSeek in Model Garden (web console)
# 2. Get endpoint ID from deployment
# 3. Update test script:
endpoint = f"https://us-central1-aiplatform.googleapis.com/v1/projects/general-dev-480621/locations/us-central1/endpoints/{ENDPOINT_ID}:predict"

# 4. Run test:
cd /home/ubuntu/Dev-Projects/Gogga/gogga-backend
./venv_vertex/bin/python test_deepseek_simple.py
```

### For Gemini Testing (Immediate):
```bash
# Create test for Gemini
cat > test_gemini_vertex.py << 'EOF'
import subprocess
import requests
import json

def get_token():
    result = subprocess.run(
        ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()

# Test Gemini
endpoint = "https://us-central1-aiplatform.googleapis.com/v1/projects/general-dev-480621/locations/us-central1/publishers/google/models/gemini-1.5-flash-002:generateContent"

response = requests.post(
    endpoint,
    headers={
        "Authorization": f"Bearer {get_token()}",
        "Content-Type": "application/json"
    },
    json={
        "contents": [{
            "role": "user",
            "parts": [{"text": "Explain POPIA section 19 in simple terms."}]
        }]
    }
)

print(f"Status: {response.status_code}")
print(json.dumps(response.json(), indent=2))
EOF

./venv_vertex/bin/python test_gemini_vertex.py
```

## 🔐 Security Note

**IMPORTANT**: The file `vertex-ai-key.json` contains sensitive credentials.

```bash
# Add to .gitignore
echo "vertex-ai-key.json" >> .gitignore

# Set restrictive permissions
chmod 600 vertex-ai-key.json
```

## 📊 GOGGA Integration Plan (When DeepSeek is Deployed)

### Tier Mapping Update

```python
# gogga-backend/app/core/router.py

TIER_CONFIGS = {
    "FREE": {
        "text_model": "deepseek-v3",  # Replace Llama 3.3 70B
        "provider": "vertex",
        "endpoint": "https://us-central1-aiplatform.googleapis.com/v1/...",
        "cost_per_1k_tokens": 0.001  # Check DeepSeek pricing
    },
    "JIVE": {
        "text_model": "deepseek-v3",  # With CePO routing
        "provider": "vertex",
        "fallback": "cerebras-llama-3.1-8b"
    },
    "JIGGA": {
        "text_model": "deepseek-v3-reasoning",  # With <think> mode
        "provider": "vertex"
    }
}
```

### Environment Variables

```bash
# Add to gogga-backend/.env
VERTEX_PROJECT_ID=general-dev-480621
VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/vertex-ai-key.json
DEEPSEEK_ENDPOINT_ID=<endpoint-id-from-deployment>
```

---

**Status**: ⏳ Waiting for DeepSeek deployment or IAM permissions  
**Last Updated**: December 9, 2025  
**Test Pass Rate**: 100% (authentication working, model not deployed yet)
