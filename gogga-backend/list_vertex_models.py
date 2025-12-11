"""
List available models in Google Vertex AI
"""

from google import genai
import json

def list_models():
    """List all available models."""
    
    print("🔍 Listing available models in Vertex AI")
    print("=" * 60)
    
    try:
        client = genai.Client(
            api_key="AQ.Ab8RN6KroCuMxSkr9xo_bIfSIq4ZiWvijV1Cdvm-0YR-1jXRmQ"
        )
        print("✅ Client initialized\n")
        
        # Try to list models
        try:
            models = client.models.list()
            print("📋 Available models:")
            for model in models:
                print(f"\n  • {model.name}")
                if hasattr(model, 'display_name'):
                    print(f"    Display: {model.display_name}")
                if hasattr(model, 'description'):
                    print(f"    Description: {model.description[:100]}...")
        except Exception as e:
            print(f"❌ Could not list models: {e}")
            print("\n💡 Trying to access model directly...")
            
            # Try common model paths
            test_models = [
                "publishers/deepseek-ai/models/DeepSeek-V3.2",
                "deepseek-v3.2",
                "deepseek",
                "models/deepseek-v3.2",
                "gemini-pro",
                "models/gemini-pro"
            ]
            
            for model_name in test_models:
                try:
                    print(f"\n  Testing: {model_name}")
                    response = client.models.generate_content(
                        model=model_name,
                        contents="Hello"
                    )
                    print(f"    ✅ {model_name} works!")
                    break
                except Exception as e:
                    print(f"    ❌ {type(e).__name__}: {str(e)[:80]}")
            
    except Exception as e:
        print(f"❌ Client initialization failed: {e}")

if __name__ == "__main__":
    list_models()
