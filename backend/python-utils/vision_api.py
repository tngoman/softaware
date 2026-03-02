#!/usr/bin/env python3
"""
Vision API - Image description service using Ollama
Reliable setup for CPU-based inference
"""
import urllib.request
import urllib.error
import json
import base64
import sys
import os
from pathlib import Path

# Configuration
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llava:7b-v1.6"  # Best balance: accurate and reasonably fast
TIMEOUT = 180  # 3 minutes for CPU inference

def describe_image(image_path, prompt="List only what you see: text, company names, logos. No descriptions or commentary."):
    """
    Analyze an image and return a text description.
    
    Args:
        image_path: Path to the image file
        prompt: Custom prompt for the model (default: strict factual listing)
    
    Returns:
        str: Image description or error message
    """
    if not os.path.exists(image_path):
        return f"Error: Image file not found: {image_path}"
    
    try:
        # Read and encode image
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Prepare request
        data = {
            "model": MODEL,
            "prompt": prompt,
            "images": [encoded_string],
            "stream": True
        }
        
        req = urllib.request.Request(
            OLLAMA_URL, 
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        # Send request and collect response
        full_response = ""
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            for line in response:
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        if "response" in chunk and chunk["response"]:
                            full_response += chunk["response"]
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
        
        return full_response.strip() if full_response else "No response from model"
        
    except urllib.error.URLError as e:
        return f"Network error: {e}"
    except Exception as e:
        return f"Error: {e}"

def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python3 vision_api.py <image_path> [custom_prompt]")
        print(f"\nCurrent model: {MODEL}")
        print(f"Timeout: {TIMEOUT}s")
        sys.exit(1)
    
    image_path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else "Describe this image in detail."
    
    print(f"Analyzing: {image_path}")
    print(f"Model: {MODEL}")
    print("-" * 60)
    
    result = describe_image(image_path, prompt)
    print(result)
    print("-" * 60)

if __name__ == "__main__":
    main()
