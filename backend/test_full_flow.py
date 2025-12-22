#!/usr/bin/env python3
"""
Comprehensive End-to-End Test Suite
Tests the ENTIRE workflow to catch all issues
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_chat(message, description):
    """Test a chat message and print results"""
    print(f"\n{'='*80}")
    print(f"TEST: {description}")
    print(f"Message: '{message}'")
    print(f"{'='*80}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/workflow/chat",
            json={"message": message},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS")
            print(f"Current Step: {data.get('current_step')}")
            print(f"Is Support: {data.get('is_support_response', False)}")
            print(f"Message: {data.get('message', '')[:200]}")
            if data.get('error'):
                print(f"⚠️  ERROR IN RESPONSE: {data['error']}")
            return data
        else:
            print(f"❌ FAILED: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"❌ EXCEPTION: {str(e)}")
        return None

def run_full_test():
    """Run comprehensive test suite"""
    print("\n" + "="*80)
    print("🧪 COMPREHENSIVE END-TO-END TEST SUITE")
    print("="*80)
    
    # Test 1: Greeting (should trigger support)
    test_chat("hi", "Greeting - should show welcome message")
    time.sleep(1)
    
    # Test 2: Gibberish (should trigger support)
    test_chat("asdfghjkl", "Gibberish - should trigger help")
    time.sleep(1)
    
    # Test 3: Help question (should trigger support)
    test_chat("how do I connect Facebook?", "Help question - should show guide")
    time.sleep(1)
    
    # Test 4: Confirmation (should be navigation)
    test_chat("yes", "Confirmation - should proceed")
    time.sleep(1)
    
    # Test 5: Next command (should navigate)
    test_chat("next", "Next command - should move forward")
    time.sleep(1)
    
    # Test 6: Back command (should navigate)
    test_chat("go back", "Back command - should go back")
    time.sleep(1)
    
    # Test 7: Product URL (should scrape)
    test_chat("https://www.flipkart.com/marq-flipkart-584-l-frost-free-side-side-refrigerator-water-dispenser-fresh-lock-multi-airflow-technology-silver-584ms025mqsd/p/itm7e1b3e1c3c8f1", 
              "Product URL - should start scraping")
    time.sleep(2)
    
    print("\n" + "="*80)
    print("🏁 TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    run_full_test()
