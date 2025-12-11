import subprocess, requests, json

token = subprocess.run(
    ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
    capture_output=True, text=True, check=True
).stdout.strip()

project = "general-dev-480621"
location = "us-central1"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
payload = {"contents": [{"role": "user", "parts": [{"text": "Hello"}]}]}

# Test known model paths
models = [
    "google/gemini-1.5-flash-002",
    "google/gemini-1.5-pro-002",
    "google/gemini-2.0-flash-exp",
    "anthropic/claude-3-5-sonnet-v2@20241022",
    "meta/llama-3.2-90b-vision-instruct-maas",
]

print("🧪 Testing Known Models\n" + "="*60)

for model_path in models:
    publisher, model = model_path.split('/')
    endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/{publisher}/models/{model}:generateContent"
    
    print(f"\n📝 {model_path}")
    try:
        r = requests.post(endpoint, headers=headers, json=payload, timeout=15)
        if r.status_code == 200:
            print(f"   ✅ WORKS")
        else:
            print(f"   ❌ {r.status_code}: {r.text[:80]}")
    except Exception as e:
        print(f"   ❌ {str(e)[:80]}")
