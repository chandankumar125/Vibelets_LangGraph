import sys
import os
import asyncio
import traceback

sys.path.append(os.getcwd())

async def main():
    try:
        from server_langgraph import workflow
        
        print(f"Workflow Type: {type(workflow)}")
        print(f"Workflow App Type: {type(workflow.app)}")
        
        if hasattr(workflow.app, "update_state"):
            print("✅ app has update_state")
        else:
            print("❌ app MISSING update_state")
            print(f"Dir: {dir(workflow.app)}")
            
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
