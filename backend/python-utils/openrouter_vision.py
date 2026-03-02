#!/usr/bin/env python3
"""
OpenRouter Vision API - Test free vision models
"""
import requests
import base64
import sys
import os

# Configuration
OPENROUTER_API_KEY = "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"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
SITE_URL = "https://softaware.net.za"  # Required by OpenRouter
APP_NAME = "Vision Analysis Tool"  # Required by OpenRouter

# Free vision models on OpenRouter
MODELS = {
    "gemini": "google/gemini-2.0-flash-exp:free",
    "qwen-vl": "qwen/qwen-2-vl-7b-instruct:free",
    "llama-vision": "meta-llama/llama-3.2-11b-vision-instruct:free"
}

def encode_image(image_path):
    """Encode image to base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_image(image_path, model_key="qwen-vl", prompt="Describe what you see in this image. Be concise and accurate."):
    """
    Analyze an image using OpenRouter vision models
    
    Args:
        image_path: Path to the image file
        model_key: Model to use (gemini, qwen-vl, llama-vision)
        prompt: Custom prompt for analysis
    
    Returns:
        str: Model response or error message
    """
    if not os.path.exists(image_path):
        return f"Error: Image file not found: {image_path}"
    
    if model_key not in MODELS:
        return f"Error: Invalid model. Choose from: {', '.join(MODELS.keys())}"
    
    model = MODELS[model_key]
    
    try:
        # Encode image
        base64_image = encode_image(image_path)
        
        # Prepare request
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": SITE_URL,
            "X-Title": APP_NAME,
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ]
        }
        
        # Send request
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            return f"Unexpected response format: {result}"
            
    except requests.exceptions.Timeout:
        return "Error: Request timed out"
    except requests.exceptions.RequestException as e:
        return f"Request error: {e}"
    except Exception as e:
        return f"Error: {e}"

def main():
    """CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python3 openrouter_vision.py <image_path> [model] [prompt]")
        print(f"\nAvailable models:")
        for key, value in MODELS.items():
            print(f"  {key}: {value}")
        print(f"\nDefault: google-flash")
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_key = sys.argv[2] if len(sys.argv) > 2 else "qwen-vl"
    prompt = sys.argv[3] if len(sys.argv) > 3 else "Describe what you see in this image. Be concise and accurate."
    
    print(f"Analyzing: {image_path}")
    print(f"Model: {MODELS.get(model_key, 'unknown')}")
    print("-" * 60)
    
    result = analyze_image(image_path, model_key, prompt)
    print(result)
    print("-" * 60)

if __name__ == "__main__":
    main()
