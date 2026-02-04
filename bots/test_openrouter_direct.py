#!/usr/bin/env python3
"""Direct test of OpenRouter API."""
import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# Load env
load_dotenv(Path(__file__).parent / ".env")

api_key = os.getenv("OPENROUTER_API_KEY")
model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")

print(f"🔑 API Key: {api_key[:20]}...")
print(f"🤖 Model: {model}")
print()

# Test simple completion
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

print("📡 Testing OpenRouter API...")
print("-" * 60)

try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'Hello from OpenRouter!' in JSON format: {\"message\": \"...\"}"}
        ],
        temperature=0.7,
    )
    
    content = response.choices[0].message.content
    print(f"✅ Success!")
    print(f"Response: {content}")
    print()
    print(f"Model used: {response.model}")
    print(f"Tokens: {response.usage.total_tokens if response.usage else 'N/A'}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
