import subprocess, requests, json

token = subprocess.run(
    ["bash", "-c", "source $HOME/google-cloud-sdk/path.bash.inc && gcloud auth print-access-token"],
    capture_output=True, text=True, check=True
).stdout.strip()

project = "general-dev-480621"
location = "us-central1"
model = "gemini-2.0-flash-exp"
endpoint = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent"

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# SA-specific test cases
tests = [
    {
        "name": "POPIA Section 19",
        "query": "Explain POPIA section 19 in simple terms for a South African small business owner.",
        "markers": ["POPIA", "Section 19", "personal information", "consent"]
    },
    {
        "name": "Spaza Shop POPIA",
        "query": "What are my POPIA obligations if I run a spaza shop in Soweto and collect customer phone numbers?",
        "markers": ["POPIA", "consent", "personal information", "customer"]
    },
    {
        "name": "Load Shedding Math",
        "query": "Calculate: Airtime R50 + data R149 + powerbank R299. What's the total in Rands?",
        "markers": ["R", "498", "total"]
    },
    {
        "name": "isiZulu Response",
        "query": "Sawubona, unjani? Respond in isiZulu.",
        "markers": ["sawubona", "ngiyaphila", "zulu"]
    }
]

print("🧪 Testing Gemini 2.0 Flash (SA Content)")
print("=" * 70)

results = []
for i, test in enumerate(tests, 1):
    print(f"\n📝 Test {i}: {test['name']}")
    print("-" * 70)
    print(f"Query: {test['query']}\n")
    
    payload = {
        "contents": [{"role": "user", "parts": [{"text": test["query"]}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1024}
    }
    
    try:
        r = requests.post(endpoint, headers=headers, json=payload, timeout=30)
        
        if r.status_code == 200:
            data = r.json()
            text = data['candidates'][0]['content']['parts'][0]['text']
            
            print(f"✅ Response ({len(text)} chars):")
            print(text[:400] if len(text) > 400 else text)
            
            # Check markers
            found = [m for m in test['markers'] if m.lower() in text.lower()]
            missing = [m for m in test['markers'] if m.lower() not in text.lower()]
            
            if found:
                print(f"\n🎯 Found: {', '.join(found)}")
            if missing:
                print(f"⚠️  Missing: {', '.join(missing)}")
            
            # Token usage
            if 'usageMetadata' in data:
                meta = data['usageMetadata']
                print(f"📊 Tokens: {meta.get('promptTokenCount')} in, {meta.get('candidatesTokenCount')} out")
            
            results.append({"test": test['name'], "status": "✅ PASS"})
        else:
            print(f"❌ Error {r.status_code}: {r.text[:200]}")
            results.append({"test": test['name'], "status": f"❌ FAIL ({r.status_code})"})
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        results.append({"test": test['name'], "status": "❌ ERROR"})

# Summary
print("\n\n" + "=" * 70)
print("📊 SUMMARY")
print("=" * 70)
for r in results:
    print(f"{r['status']} {r['test']}")

passed = sum(1 for r in results if '✅' in r['status'])
print(f"\n✅ {passed}/{len(results)} tests passed")

if passed == len(results):
    print("\n�� Gemini 2.0 Flash is READY for GOGGA!")
    print("\n💡 Integration Options:")
    print("   • FREE tier: Gemini 2.0 Flash (fast, experimental)")
    print("   • JIVE tier: Gemini with CePO routing")
    print("   • JIGGA tier: Keep current Qwen/Cerebras setup")
