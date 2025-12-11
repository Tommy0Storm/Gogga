import subprocess
import requests

token = subprocess.run(
    ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
    capture_output=True, text=True, check=True
).stdout.strip()

# Try to list DeepSeek publisher models
urls = [
    "https://us-central1-aiplatform.googleapis.com/v1/projects/general-dev-480621/locations/us-central1/publishers/deepseek-ai/models",
    "https://us-central1-aiplatform.googleapis.com/v1beta1/projects/general-dev-480621/locations/us-central1/publishers/deepseek-ai/models"
]

for url in urls:
    print(f"\n🔍 {url}")
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    print(f"Status: {r.status_code}")
    print(r.text[:500])
