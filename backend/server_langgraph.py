"""
FastAPI server with LangGraph workflow integration
Supports context-aware, bidirectional navigation
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
from dotenv import load_dotenv
import uuid

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from workflow_graph import AdCampaignWorkflow
from state_schema import WorkflowState

load_dotenv()

app = FastAPI(title="Ad Campaign Generator API - LangGraph")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation Error: {exc}")
    try:
        body = await request.json()
        print(f"Request Body: {body}")
    except:
        print("Could not read body")
        
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# Initialize workflow
workflow = AdCampaignWorkflow()

# Store active sessions (thread_id -> state)
active_sessions: Dict[str, WorkflowState] = {}

# --- Pydantic Models ---

class WorkflowRequest(BaseModel):
    """Base request for workflow operations"""
    thread_id: Optional[str] = None
    navigation_intent: Optional[str] = None  # e.g., "go to analyze", "go back to scripts"
    message: Optional[str] = None  # User message for chat-based editing

class ScrapeRequest(WorkflowRequest):
    url: str

class AnalyzeRequest(WorkflowRequest):
    feedback: Optional[str] = None

class ScriptRequest(WorkflowRequest):
    feedback: Optional[str] = None

class SelectScriptRequest(WorkflowRequest):
    script_index: int

class RefineScriptRequest(WorkflowRequest):
    feedback: str

class GenerateImagesRequest(WorkflowRequest):
    feedback: Optional[str] = None
    num_images: Optional[int] = 2

class RefineImagesRequest(WorkflowRequest):
    feedback: str

class GenerateAudioRequest(WorkflowRequest):
    pass

class SelectAvatarRequest(WorkflowRequest):
    avatar_id: str

class GenerateVideoRequest(WorkflowRequest):
    pass

class SelectProductRequest(WorkflowRequest):
    product_index: Optional[int] = None
    product_data: Optional[Dict[str, Any]] = None

# --- Helper Functions ---

def get_or_create_thread(thread_id: Optional[str] = None) -> str:
    """Get existing thread_id or create new one"""
    if not thread_id:
        thread_id = str(uuid.uuid4())
    
    if thread_id not in active_sessions:
        # Initialize new state
        active_sessions[thread_id] = {
            "current_step": "scrape",
            "navigation_intent": None,
            "messages": [],
            "url": None,
            "product_data": None,
            "selected_product": None,
            "analysis": None,
            "analysis_feedback": [],
            "scripts": None,
            "script_feedback": [],
            "selected_script_index": None,
            "selected_script": None,
            "script_refinement_feedback": [],
            "generated_images": None,
            "image_feedback": [],
            "image_generation_prompt": None,
            "audio_file": None,
            "audio_url": None,
            "available_avatars": None,
            "selected_avatar_id": None,
            "video_id": None,
            "video_url": None,
            "video_status": None,
            "error": None,
            "iteration_count": {}
        }
    
    return thread_id

def update_state_from_request(state: WorkflowState, request: WorkflowRequest) -> WorkflowState:
    """Update state from request parameters"""
    if request.navigation_intent:
        state["navigation_intent"] = request.navigation_intent
        # Parse navigation intent to set current_step
        intent_lower = request.navigation_intent.lower()
        if "scrape" in intent_lower or "start" in intent_lower:
            state["current_step"] = "scrape"
        elif "analyze" in intent_lower or "analysis" in intent_lower:
            state["current_step"] = "analyze"
        elif "script" in intent_lower and "generate" in intent_lower:
            state["current_step"] = "generate_scripts"
        elif "script" in intent_lower and ("select" in intent_lower or "choose" in intent_lower):
            state["current_step"] = "select_script"
        elif "script" in intent_lower and ("refine" in intent_lower or "tweak" in intent_lower):
            state["current_step"] = "refine_script"
        elif "image" in intent_lower and "generate" in intent_lower:
            state["current_step"] = "generate_images"
        elif "image" in intent_lower and ("refine" in intent_lower or "edit" in intent_lower):
            state["current_step"] = "refine_images"
        elif "audio" in intent_lower:
            state["current_step"] = "generate_audio"
        elif "avatar" in intent_lower:
            state["current_step"] = "select_avatar"
        elif "video" in intent_lower:
            state["current_step"] = "generate_video"
    
    if request.message:
        # Add message to state for chat-based editing
        state["messages"].append({
            "role": "user",
            "content": request.message
        })
    
    return state

# --- Endpoints ---

@app.post("/api/workflow/scrape")
async def scrape_product(request: ScrapeRequest):
    """Scrape product/store URL"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["url"] = request.url
    state["current_step"] = "scrape"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "product_data": result.get("product_data"),
        "error": result.get("error")
    }

@app.post("/api/workflow/analyze")
async def analyze_product(request: AnalyzeRequest):
    """Analyze product with optional feedback"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "analyze"
    if request.feedback:
        state["analysis_feedback"].append(request.feedback)
        state["messages"].append({
            "role": "user",
            "content": request.feedback
        })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    print(f"Calling workflow.run_step for thread {thread_id}")
    result = await workflow.run_step(state, config)
    print(f"Result type: {type(result)}")
    print(f"Result: {result}")
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "analysis": result.get("analysis"),
        "error": result.get("error")
    }

@app.post("/api/workflow/generate_scripts")
async def generate_scripts(request: ScriptRequest):
    """Generate ad scripts with optional feedback"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "generate_scripts"
    if request.feedback:
        state["script_feedback"].append(request.feedback)
        state["messages"].append({
            "role": "user",
            "content": request.feedback
        })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "scripts": result.get("scripts"),
        "error": result.get("error")
    }

@app.post("/api/workflow/select_script")
async def select_script(request: SelectScriptRequest):
    """Select a script by index"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "select_script"
    state["selected_script_index"] = request.script_index
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "selected_script": result.get("selected_script"),
        "error": result.get("error")
    }

@app.post("/api/workflow/refine_script")
async def refine_script(request: RefineScriptRequest):
    """Refine selected script with feedback"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "refine_script"
    state["messages"].append({
        "role": "user",
        "content": request.feedback
    })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "selected_script": result.get("selected_script"),
        "error": result.get("error")
    }

@app.post("/api/workflow/generate_images")
async def generate_images(request: GenerateImagesRequest):
    """Generate images with optional feedback"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "generate_images"
    if request.feedback:
        state["image_feedback"].append(request.feedback)
        state["messages"].append({
            "role": "user",
            "content": request.feedback
        })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "generated_images": result.get("generated_images"),
        "image_generation_prompt": result.get("image_generation_prompt"),
        "error": result.get("error")
    }

@app.post("/api/workflow/refine_images")
async def refine_images(request: RefineImagesRequest):
    """Refine images with feedback"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "refine_images"
    state["image_feedback"].append(request.feedback)
    state["messages"].append({
        "role": "user",
        "content": request.feedback
    })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "generated_images": result.get("generated_images"),
        "image_generation_prompt": result.get("image_generation_prompt"),
        "error": result.get("error")
    }

@app.post("/api/workflow/generate_audio")
async def generate_audio(request: GenerateAudioRequest):
    """Generate audio from selected script"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "generate_audio"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "audio_file": result.get("audio_file"),
        "audio_url": result.get("audio_url"),
        "error": result.get("error")
    }

@app.post("/api/workflow/select_avatar")
async def select_avatar(request: SelectAvatarRequest):
    """Select HeyGen avatar"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "select_avatar"
    state["selected_avatar_id"] = request.avatar_id
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "available_avatars": result.get("available_avatars"),
        "selected_avatar_id": result.get("selected_avatar_id"),
        "error": result.get("error")
    }

@app.get("/api/workflow/avatars")
async def get_avatars(thread_id: Optional[str] = None):
    """Get available avatars"""
    thread_id = get_or_create_thread(thread_id)
    state = active_sessions[thread_id]
    
    # If avatars not loaded, load them
    if not state.get("available_avatars"):
        from heygen import HeyGenAvatarIntegrator
        heygen = HeyGenAvatarIntegrator()
        avatars = heygen.get_avatars()
        state["available_avatars"] = avatars
        active_sessions[thread_id] = state
    
    return {
        "thread_id": thread_id,
        "avatars": state.get("available_avatars", [])
    }

@app.post("/api/workflow/generate_video")
async def generate_video(request: GenerateVideoRequest):
    """Generate HeyGen video"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "generate_video"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "video_id": result.get("video_id"),
        "video_url": result.get("video_url"),
        "video_status": result.get("video_status"),
        "error": result.get("error")
    }

@app.get("/api/workflow/state/{thread_id}")
async def get_state(thread_id: str):
    """Get current workflow state"""
    if thread_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Thread not found")
    
    return {
        "thread_id": thread_id,
        "state": active_sessions[thread_id]
    }

@app.post("/api/workflow/navigate")
async def navigate(request: WorkflowRequest):
    """Navigate to any step in the workflow"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update navigation intent
    state = update_state_from_request(state, request)
    
    # Run workflow step (will route to appropriate node)
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "error": result.get("error")
    }

@app.post("/api/workflow/chat")
async def chat(request: WorkflowRequest):
    """Chat-based editing - automatically routes to current step with message"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # Add message to state
    state["messages"].append({
        "role": "user",
        "content": request.message
    })
    
    # Determine which step to route to based on current step
    current_step = state.get("current_step", "scrape")
    
    # If navigation intent provided, use it
    if request.navigation_intent:
        state = update_state_from_request(state, request)
        current_step = state.get("current_step")
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "error": result.get("error")
    }

@app.get("/api/workflow/stream")
async def stream_workflow(thread_id: str, message: Optional[str] = None):
    """Stream workflow events using SSE"""
    from fastapi.responses import StreamingResponse
    import json
    import asyncio

    async def event_generator():
        thread_id_val = get_or_create_thread(thread_id)
        state = active_sessions[thread_id_val]
        
        # If message provided, add to state
        if message:
            state["messages"].append({
                "role": "user",
                "content": message
            })
            
            # Simple intent check if not already set (similar to chat endpoint)
            # This is a basic fallback; ideally we use the graph's routing
            pass

        config = {"configurable": {"thread_id": thread_id_val}}
        
        try:
            # Stream events from the graph
            async for event in workflow.app.astream_events(state, config, version="v1"):
                kind = event["event"]
                
                # Stream LLM tokens for "typewriter" effect
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                
                # Stream tool/node updates
                elif kind == "on_chain_end":
                    # Check if it's a node finishing
                    if event["name"] in ["scrape", "analyze", "generate_scripts", "generate_images", "generate_audio", "generate_video", "facebook_auth"]:
                        # We can send intermediate state updates if needed
                        pass
                        
                # Handle errors
                if "error" in event:
                     yield f"data: {json.dumps({'type': 'error', 'content': str(event['error'])})}\n\n"

            # Final state update
            # We need to get the final state after streaming
            # Since astream_events doesn't return the final state directly in the loop easily for the whole graph,
            # we might need to fetch it or rely on the last "on_chain_end" of the graph.
            # For simplicity, we'll fetch the state again or rely on the fact that the graph updates the checkpointer.
            
            # Actually, let's just yield a "complete" event with the final state
            # We can get the state from the memory saver
            final_state = workflow.app.get_state(config).values
            active_sessions[thread_id_val] = final_state # Update local cache
            
            yield f"data: {json.dumps({'type': 'complete', 'state': final_state})}\n\n"
            
        except Exception as e:
            print(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Mount static files
from fastapi.staticfiles import StaticFiles
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

