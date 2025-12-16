import asyncio
import os
import json
from dotenv import load_dotenv
from AgneticFlow.workflow_graph import AdCampaignWorkflow
from AgneticFlow.state_schema import WorkflowState

# Load environment variables
load_dotenv()

async def test_facebook_flow():
    print("Starting Facebook Flow Test...")
    
    # Initialize workflow
    workflow = AdCampaignWorkflow()
    
    # Mock initial state with some product data and generated media
    initial_state = {
        "current_step": "generate_video",
        "product_data": {
            "title": "Test Product",
            "description": "A great test product for Facebook ads.",
            "price": "$99.99"
        },
        "video_url": "http://localhost:8000/generated_videos/test_video.mp4",
        "generated_images": [
            "http://localhost:8000/generated_images/test_image_1.png",
            "http://localhost:8000/generated_images/test_image_2.png"
        ],
        "messages": []
    }
    
    print(f"Initial State: {initial_state['current_step']}")
    
    # 1. Simulate User requesting Facebook Campaign
    print("\n--- Step 1: Trigger Facebook Campaign ---")
    initial_state["messages"].append({"role": "user", "content": "Create Facebook Campaign"})
    
    # Run workflow to route to facebook_auth
    config = {"configurable": {"thread_id": "test_thread_fb"}}
    state = await workflow.app.ainvoke(initial_state, config)
    print(f"Current Step: {state['current_step']}")
    
    if state['current_step'] != "facebook_auth":
        print("FAILED: Did not route to facebook_auth")
        return

    # 2. Simulate User providing Access Token (Mock)
    print("\n--- Step 2: Provide Access Token ---")
    # In a real scenario, the frontend sends the token. Here we simulate it.
    # We need a valid token for this to actually work against the API, 
    # but for the test flow logic, we can mock the validation if we want, 
    # or expect it to fail if no real token is provided.
    # For this test file, let's assume the user puts a token in .env or we prompt for it.
    
    token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    if not token:
        print("WARNING: No FACEBOOK_ACCESS_TOKEN in .env. Using a dummy token. API calls will fail.")
        token = "dummy_token"
        
    state["messages"].append({"role": "user", "content": token})
    
    # Run workflow to validate token and fetch ad accounts
    # Note: If token is dummy, _facebook_auth_node might fail or return error.
    # We might need to mock the auth function if we want to test flow without real creds.
    # But the user asked to check the "fb agent flow", implying real agents.
    
    try:
        state = await workflow.app.ainvoke(state, config)
        print(f"Current Step: {state['current_step']}")
        if "error" in state:
            print(f"Error: {state['error']}")
            # If error, we can't proceed easily.
    except Exception as e:
        print(f"Execution Error: {e}")

    # 3. Simulate Ad Account Selection
    if state['current_step'] == "select_ad_account":
        print("\n--- Step 3: Select Ad Account ---")
        ad_accounts = state.get("ad_accounts", [])
        if ad_accounts:
            print(f"Found {len(ad_accounts)} ad accounts.")
            # Select the first one
            first_account_id = ad_accounts[0]['id']
            print(f"Selecting account: {first_account_id}")
            state["messages"].append({"role": "user", "content": f"Select account {first_account_id}"})
            # Or just update state directly if the node expects it
            # The node expects state["selected_ad_account_id"] to be set OR parsed?
            # Let's check logic. The node checks state.get("selected_ad_account_id").
            # It doesn't parse chat. So we must manually set it in state for this test,
            # OR the previous step (frontend) would have set it.
            # In the real app, the frontend sets it via API or chat.
            # Let's simulate the state update.
            state["selected_ad_account_id"] = first_account_id
            
            state = await workflow.app.ainvoke(state, config)
            print(f"Current Step: {state['current_step']}")
        else:
            print("No ad accounts found (expected with dummy token).")

    # 4. Simulate Media Selection
    if state['current_step'] == "select_media":
        print("\n--- Step 4: Select Media ---")
        # Simulate selecting the video
        state["selected_media"] = {
            "type": "video",
            "url": state["video_url"],
            "filename": "test_video.mp4"
        }
        state = await workflow.app.ainvoke(state, config)
        print(f"Current Step: {state['current_step']}")

    # 5. Simulate Campaign Preview Generation
    if state['current_step'] == "preview_campaign":
        print("\n--- Step 5: Generate Preview ---")
        # This step runs automatically to generate config
        # It might have already run in the previous ainvoke if it was a direct transition?
        # Let's check graph. select_media -> preview_campaign (via route or direct edge?)
        # workflow.add_edge("select_media", END) -> It waits for user? 
        # Actually, select_media node updates state and returns. 
        # The route logic should send it to preview_campaign?
        # Let's check _route_logic.
        # If current_step is select_media, and we have selected_media, it goes to preview_campaign.
        
        # So we might need to invoke again to trigger the next step if it stopped at END.
        state = await workflow.app.ainvoke(state, config)
        print(f"Current Step: {state['current_step']}")
        
        if state.get("campaign_config"):
            print("Campaign Config Generated:")
            print(json.dumps(state["campaign_config"], indent=2))

    # 6. Simulate Publish
    if state['current_step'] == "refine_campaign":
        print("\n--- Step 6: Publish Campaign ---")
        state["messages"].append({"role": "user", "content": "Publish"})
        state = await workflow.app.ainvoke(state, config)
        print(f"Current Step: {state['current_step']}")
        print(f"Publish Status: {state.get('publish_status')}")

if __name__ == "__main__":
    asyncio.run(test_facebook_flow())
