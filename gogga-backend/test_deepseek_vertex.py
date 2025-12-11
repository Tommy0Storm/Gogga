"""
DeepSeek-V3.2 via Google Vertex AI - Test Script
Tests the model with POPIA Section 19 query (SA-specific legal content)
"""

import os
from google import genai

def test_deepseek_vertex():
    """Test DeepSeek-V3.2 model via Vertex AI with SA legal query."""
    
    print("🧪 Testing DeepSeek-V3.2 via Google Vertex AI")
    print("=" * 60)
    
    # Initialize client with API key (no project/location needed)
    try:
        client = genai.Client(
            api_key="AQ.Ab8RN6KroCuMxSkr9xo_bIfSIq4ZiWvijV1Cdvm-0YR-1jXRmQ"
        )
        print("✅ Client initialized")
    except Exception as e:
        print(f"❌ Client initialization failed: {e}")
        print(f"Error type: {type(e).__name__}")
        return
    
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
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}: {test['description']}")
        print(f"Query: {test['query']}")
        print("-" * 60)
        
        try:
            # Generate response
            response = client.models.generate_content(
                model="publishers/deepseek-ai/models/DeepSeek-V3.2",
                contents=test["query"]
            )
            
            # Extract response text
            response_text = response.text if hasattr(response, 'text') else str(response)
            
            print(f"✅ Response received ({len(response_text)} chars):")
            print(response_text[:500] + "..." if len(response_text) > 500 else response_text)
            
            # Check for SA-specific context
            sa_markers = ["South Africa", "POPIA", "Information Regulator", "ZAR", "R"]
            found_markers = [m for m in sa_markers if m.lower() in response_text.lower()]
            
            if found_markers:
                print(f"🇿🇦 SA Context Detected: {', '.join(found_markers)}")
            else:
                print("⚠️  No SA-specific markers found")
            
            # Check metadata if available
            if hasattr(response, 'usage_metadata'):
                print(f"📊 Tokens - Input: {response.usage_metadata.prompt_token_count}, Output: {response.usage_metadata.candidates_token_count}")
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
            print(f"Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("🏁 Testing complete")

def test_model_capabilities():
    """Test model parameters and settings."""
    
    print("\n🔧 Testing Model Capabilities")
    print("=" * 60)
    
    try:
        client = genai.Client(
            api_key="AQ.Ab8RN6KroCuMxSkr9xo_bIfSIq4ZiWvijV1Cdvm-0YR-1jXRmQ"
        )
        
        # Test with generation config
        response = client.models.generate_content(
            model="publishers/deepseek-ai/models/DeepSeek-V3.2",
            contents="What is your model name and version?",
            config={
                "temperature": 0.7,
                "top_p": 0.95,
                "max_output_tokens": 1024
            }
        )
        
        print("✅ Generation config supported")
        print(f"Response: {response.text[:200] if hasattr(response, 'text') else str(response)[:200]}...")
        
    except Exception as e:
        print(f"❌ Config test failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 Starting DeepSeek-V3.2 Vertex AI Tests")
    print("Project: general-dev-480621")
    print("Location: us-central1")
    print()
    
    test_deepseek_vertex()
    test_model_capabilities()
