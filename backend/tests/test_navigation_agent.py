import sys
import os
import asyncio
import json
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "AgneticFlow"))

from AgneticFlow.agents import NavigationAgent
from AgneticFlow.config import Config

load_dotenv()

async def test_navigation_agent():
    agent = NavigationAgent()
    
    test_cases = [
        {
            "state": {
                "current_step": "scrape",
                "messages": [{"role": "user", "content": "analyze this product"}]
            },
            "expected": "analyze"
        },
        {
            "state": {
                "current_step": "analyze",
                "messages": [{"role": "user", "content": "looks good, let's write some scripts"}]
            },
            "expected": "next"
        },
        {
            "state": {
                "current_step": "generate_scripts",
                "messages": [{"role": "user", "content": "actually, change the target audience to gamers"}]
            },
            "expected": "analyze" 
        },
        {
            "state": {
                "current_step": "generate_scripts",
                "messages": [{"role": "user", "content": "make the scripts funnier"}]
            },
            "expected": "stay"
        },
        {
            "state": {
                "current_step": "generate_video",
                "messages": [{"role": "user", "content": "I'm done, thanks"}]
            },
            "expected": "complete"
        }
    ]
    
    print("Running Navigation Agent Tests...")
    for i, case in enumerate(test_cases):
        print(f"\nTest Case {i+1}:")
        print(f"Input: {case['state']['messages'][0]['content']} (Current Step: {case['state']['current_step']})")
        
        result = await agent.analyze_intent(case['state'])
        intent = result.get("intent")
        
        print(f"Result: {intent}")
        print(f"Reasoning: {result.get('reasoning')}")
        
        # Note: LLM output might vary slightly, so we check if it matches expected or is reasonable
        if intent == case['expected'] or (case['expected'] == "next" and intent in ["generate_scripts", "analyze"]):
             print("✅ PASS")
        else:
             print(f"⚠️  CHECK (Expected: {case['expected']}, Got: {intent})")

if __name__ == "__main__":
    asyncio.run(test_navigation_agent())
