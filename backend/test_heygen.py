import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("HEYGEN_API_KEY")
print(f"API Key present: {bool(api_key)}")

headers = {
    "X-Api-Key": api_key,
    "Content-Type": "application/json"
}

# 1. Test List Avatars
print("\n--- Testing List Avatars ---")
try:
    import time
    for i in range(3):
        print(f"Attempt {i+1}...")
        resp = requests.get("https://api.heygen.com/v2/avatars", headers=headers)
        if resp.status_code == 200:
            break
        print(f"Status: {resp.status_code}")
        time.sleep(2)
    print(f"Final Status: {resp.status_code}")
    if resp.status_code == 200:
        avatars = resp.json().get('data', {}).get('avatars', [])
        print(f"Found {len(avatars)} avatars")
        if avatars:
            print(f"First avatar: {avatars[0]['avatar_id']} ({avatars[0]['avatar_name']})")
    else:
        print(f"Error: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")

# 2. Test Video Generation (Simple)
# 2. Test Video Generation (Simple)
print("\n--- Testing Video Generation (Simple Text) ---")

# Use a valid avatar from the list if available
test_avatar_id = "Albert_public_normal_2.0" 
if 'avatars' in locals() and avatars:
    test_avatar_id = avatars[0]['avatar_id']
    print(f"Using avatar: {test_avatar_id}")

payload = {
    "video_inputs": [
        {
            "character": {
                "type": "avatar",
                "avatar_id": test_avatar_id,
                "avatar_style": "normal"
            },
            "voice": {
                "type": "text",
                "input_text": "Hello, this is a test.",
                "voice_id": "1bd001e7e50f421d891986aad5158bc8" # Default HeyGen voice
            }
        }
    ],
    "test": True,
    "dimension": {
        "width": 1280,
        "height": 720
    }
}

try:
    for i in range(3):
        print(f"Video Attempt {i+1}...")
        resp = requests.post("https://api.heygen.com/v2/video/generate", headers=headers, json=payload)
        if resp.status_code == 200:
            break
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        time.sleep(2)
        
    print(f"Final Video Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")

try:
    resp = requests.post("https://api.heygen.com/v2/video/generate", headers=headers, json=payload)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
