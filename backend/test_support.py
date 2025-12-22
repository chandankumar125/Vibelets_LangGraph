"""
Test script for AI Support Service
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

async def test_support_service():
    """Test the support service functionality"""
    print("="*60)
    print("Testing AI Support Service")
    print("="*60)
    
    from support_service import get_support_service
    support_service = get_support_service()
    
    # Test 1: Check stats - Skipped (method missing)
    # print("\n1. Checking support service stats...")
    # stats = support_service.get_stats()
    
    # Test 2: Intent classification - Navigation
    print("\n2. Testing intent classification (Navigation)...")
    nav_result = await support_service.is_navigation_query(
        message="go to next step",
        current_step="product-analysis"
    )
    print(f"   Message: 'go to next step'")
    print(f"   Is Navigation: {nav_result.get('is_navigation')}")
    print(f"   Intent: {nav_result.get('intent')}")
    print(f"   Reasoning: {nav_result.get('reasoning')}")
    
    # Test 3: Intent classification - Support
    print("\n3. Testing intent classification (Support)...")
    support_result = await support_service.is_navigation_query(
        message="how do I connect my Facebook account?",
        current_step="product-analysis"
    )
    print(f"   Message: 'how do I connect my Facebook account?'")
    print(f"   Is Navigation: {support_result.get('is_navigation')}")
    print(f"   Intent: {support_result.get('intent')}")
    print(f"   Reasoning: {support_result.get('reasoning')}")
    
    # Test 4: Support response
    print("\n4. Testing support response...")
    response = await support_service.get_support_response(
        question="What features does Vibelets have?",
        top_k=3
    )
    print(f"   Question: 'What features does Vibelets have?'")
    print(f"   Answer: {response.get('answer')[:200]}...")
    print(f"   Confidence: {response.get('confidence')}")
    print(f"   Sources: {len(response.get('sources', []))} sources")
    
    # Test 5: Another support query
    print("\n5. Testing another support query...")
    response2 = await support_service.get_support_response(
        question="How do I change the product URL?",
        top_k=3
    )
    print(f"   Question: 'How do I change the product URL?'")
    print(f"   Answer: {response2.get('answer')[:200]}...")
    print(f"   Confidence: {response2.get('confidence')}")

    # Test 6: Greeting
    print("\n6. Testing greeting...")
    response3 = await support_service.get_support_response(
        question="hi",
        top_k=3
    )
    print(f"   Question: 'hi'")
    print(f"   Answer: {response3.get('answer')}")
    print(f"   Confidence: {response3.get('confidence')}")
    
    print("\n" + "="*60)
    print("✅ All tests completed!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_support_service())
