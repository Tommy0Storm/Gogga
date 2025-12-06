#!/usr/bin/env python3
"""
GOGGA Tool Calling Test Script
Tests Cerebras tool calling with JIVE (Llama 3.3 70B) and JIGGA (Qwen 3 32B)
"""
import os
import json
import re
from cerebras.cloud.sdk import Cerebras

# Initialize Cerebras client
client = Cerebras(
    api_key=os.environ.get("CEREBRAS_API_KEY"),
)

# Simple calculator tool
def calculate(expression: str) -> str:
    """Evaluate a math expression safely."""
    expression = re.sub(r'[^0-9+\-*/().]', '', expression)
    try:
        result = eval(expression)
        return str(result)
    except (SyntaxError, ZeroDivisionError, NameError, TypeError, OverflowError):
        return "Error: Invalid expression"

# Tool schema (strict mode required)
tools = [
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "strict": True,
            "description": "A calculator that performs basic arithmetic. Use for any math computation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "The mathematical expression to evaluate (e.g., '15 * 7')"
                    }
                },
                "required": ["expression"]
            }
        }
    }
]

available_functions = {"calculate": calculate}

def test_tool_calling(model: str, prompt: str):
    """Test tool calling with a specific model."""
    print(f"\n{'='*60}")
    print(f"Testing: {model}")
    print(f"Prompt: {prompt}")
    print('='*60)
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant with a calculator tool. Use it for math."},
        {"role": "user", "content": prompt},
    ]
    
    # Multi-turn loop (Qwen 3 32B supports this, Llama 3.3 70B has limitations)
    max_turns = 5
    turn = 0
    
    while turn < max_turns:
        turn += 1
        print(f"\n--- Turn {turn} ---")
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            parallel_tool_calls=False,
        )
        
        msg = response.choices[0].message
        
        # No tool calls = final answer
        if not msg.tool_calls:
            print(f"✅ Final Answer: {msg.content}")
            return msg.content
        
        # Process tool call
        call = msg.tool_calls[0]
        fname = call.function.name
        print(f"🔧 Tool Call: {fname}({call.function.arguments})")
        
        if fname not in available_functions:
            print(f"❌ Unknown tool: {fname}")
            return None
        
        args = json.loads(call.function.arguments)
        result = available_functions[fname](**args)
        print(f"📊 Result: {result}")
        
        # For Llama 3.3 70B, clear tool_calls to avoid errors
        if "llama" in model.lower():
            messages.append({
                "role": "assistant",
                "content": f"Calculating: {args.get('expression', '')}",
                "tool_calls": []
            })
        else:
            # Qwen 3 32B can handle the full message
            messages.append(msg.model_dump())
        
        # Add tool response
        messages.append({
            "role": "tool",
            "tool_call_id": call.id,
            "content": json.dumps(result),
        })
    
    print("⚠️ Max turns reached")
    return None

if __name__ == "__main__":
    # Test with JIGGA model (Qwen 3 32B) - supports multi-turn tool calling
    test_tool_calling(
        model="qwen-3-32b",  # JIGGA tier
        prompt="What's 15 multiplied by 7?"
    )
    
    # Test multi-turn with JIGGA
    test_tool_calling(
        model="qwen-3-32b",
        prompt="First multiply 15 by 7, then add 20 to that result, then divide by 2. What's the final number?"
    )
    
    # Test with JIVE model (Llama 3.3 70B) - limited multi-turn support
    test_tool_calling(
        model="llama-3.3-70b",  # JIVE tier  
        prompt="What's 42 divided by 6?"
    )
