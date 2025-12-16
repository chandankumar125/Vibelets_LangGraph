import requests
import json

url = "http://localhost:8000/agent/preview"
payload = {
    "user_instructions": "Create a traffic campaign for shoes. Set budget to 5000 INR. Headline: Best Shoes.",
    "thread_id": "test_thread_1"
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()['data']
        print("Campaign Name:", data.get('campaign_name'))
        print("Objective:", data.get('objective'))
        print("Budget:", data.get('daily_budget'))
        print("Headline:", data.get('headline'))
        print("Keys returned:", list(data.keys()))
    else:
        print("Error:", response.text)
except Exception as e:
    print(f"Connection failed: {e}")
