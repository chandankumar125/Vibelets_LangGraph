"""
FastAPI server with LangGraph workflow integration
Supports context-aware, bidirectional navigation
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv
import os

# Load env variables before other imports
load_dotenv(override=True)

import uuid
import json
from pathlib import Path

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from workflow_graph import AdCampaignWorkflow
from state_schema import WorkflowState

from support_service import get_support_service
from fastapi.staticfiles import StaticFiles

# Create static directory if it doesn't exist
os.makedirs("static", exist_ok=True)
os.makedirs("static/scraped_products", exist_ok=True)
os.makedirs("static/videos", exist_ok=True)
os.makedirs("static/images", exist_ok=True)
os.makedirs("static/cache", exist_ok=True)

app = FastAPI(title="Ad Campaign Generator API - LangGraph")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/api/static", StaticFiles(directory="static"), name="api_static")

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

@app.on_event("startup")
async def startup_event():
    print("🚀 Warming up Support Service...")
    get_support_service()
    print("✅ Support Service Ready")

@app.middleware("http")
async def exception_logging_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        import traceback
        print(f"CRASH IN {request.url.path}:")
        traceback.print_exc()
        try:
            with open("backend_panic.log", "w") as f:
                 traceback.print_exc(file=f)
        except:
            pass
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "trace": traceback.format_exc()}
        )

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
SESSION_FILE = "active_sessions.json"

def save_sessions():
    """Save active sessions to disk atomically"""
    try:
        serializable_sessions = {}
        for tid, state in active_sessions.items():
            serializable_sessions[tid] = dict(state)
        
        # Write to temporary file first to prevent corruption on crash/restart
        temp_file = f"{SESSION_FILE}.tmp"
        with open(temp_file, "w") as f:
            json.dump(serializable_sessions, f, indent=2)
        
        # Rename temp file to actual file
        os.replace(temp_file, SESSION_FILE)
    except Exception as e:
        print(f"Error saving sessions: {e}")

def load_sessions():
    """Load active sessions from disk"""
    global active_sessions
    try:
        if os.path.exists(SESSION_FILE):
            with open(SESSION_FILE, "r") as f:
                data = json.load(f)
                active_sessions = data
                print(f"Loaded {len(active_sessions)} sessions from disk")
    except Exception as e:
        print(f"Error loading sessions: {e}")

# Initial load
load_sessions()

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

# Facebook Campaign Models
class FacebookAuthRequest(WorkflowRequest):
    access_token: str

class SelectAdAccountRequest(WorkflowRequest):
    ad_account_id: str

class SelectMediaRequest(WorkflowRequest):
    media_type: str  # "image" or "video"
    media_url: str

class ReffineCampaignRequest(WorkflowRequest):
    feedback: str

class PublishCampaignRequest(WorkflowRequest):
    pass

# --- Helper Functions ---

def get_or_create_thread(thread_id: Optional[str] = None) -> str:
    """Get existing thread_id or create new one"""
    if not thread_id:
        thread_id = str(uuid.uuid4())
    
    if thread_id not in active_sessions:
        # Initialize new state
        from datetime import datetime
        active_sessions[thread_id] = {
            "thread_title": "New Campaign",
            "updated_at": datetime.now().isoformat(),
            "current_step": "product-url",
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
            "available_avatars": [],
            "selected_avatar_id": None,
            "video_id": None,
            "video_url": None,
            "video_status": None,
            "error": None,
            "iteration_count": {},
            "facebook_access_token": None,
            "facebook_user_id": None,
            "ad_accounts": None,
            "selected_ad_account_id": None,
            "facebook_pages": None,
            "selected_page_id": None,
            "selected_media": None,
            "campaign_config": None,
            "campaign_preview": None,
            "publish_status": None,
            "final_campaign_id": None
        }
        save_sessions()
    else:
        # Update timestamp for existing session
        from datetime import datetime
        active_sessions[thread_id]["updated_at"] = datetime.now().isoformat()
    
    return thread_id

def update_state_from_request(state: WorkflowState, request: WorkflowRequest) -> WorkflowState:
    """Update state from request parameters"""
    # Clear any previous errors when starting a new operation
    state["error"] = None
    
    if request.navigation_intent:
        state["navigation_intent"] = request.navigation_intent
        # Parse navigation intent to set current_step
        intent_lower = request.navigation_intent.lower()
        if "scrape" in intent_lower or "start" in intent_lower:
            state["current_step"] = "product-url"
        elif "analyze" in intent_lower or "analysis" in intent_lower:
            state["current_step"] = "product-analysis"
        elif "script" in intent_lower and "generate" in intent_lower:
            state["current_step"] = "script-selection"
        elif "script" in intent_lower and ("select" in intent_lower or "choose" in intent_lower):
            state["current_step"] = "script-selection"
        elif "script" in intent_lower and ("refine" in intent_lower or "tweak" in intent_lower):
            state["current_step"] = "script-selection"
        elif "image" in intent_lower and "generate" in intent_lower:
            state["current_step"] = "creative-generation"
        elif "image" in intent_lower and ("refine" in intent_lower or "edit" in intent_lower):
            state["current_step"] = "creative-review"
        elif "audio" in intent_lower:
            state["current_step"] = "creative-generation"
        elif "avatar" in intent_lower:
            state["current_step"] = "avatar-selection"
        elif "video" in intent_lower:
            state["current_step"] = "creative-generation"
    
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
    
    # Ensure URL has a scheme for proper validation and scraping
    url_to_scrape = request.url
    if not url_to_scrape.startswith(('http://', 'https://')):
        url_to_scrape = 'https://' + url_to_scrape
        print(f"DEBUG: Prepended 'https://' to URL: {url_to_scrape}")

    # Basic URL validation (simple check)
    if '.' not in url_to_scrape or len(url_to_scrape) < 8:
        error_msg = f"Invalid URL provided: {request.url}"
        print(f"ERROR: {error_msg}")
        state["error"] = error_msg
        state["current_step"] = "product-url"
        save_sessions()
        return {
            "thread_id": thread_id,
            "state": state,
            "current_step": state.get("current_step"),
            "error": error_msg
        }

    # Update state
    state["url"] = url_to_scrape
    state["current_step"] = "product-url"
    state["navigation_intent"] = "scrape"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    print(f"DEBUG: Scrape Start - Thread: {thread_id}, URL: {request.url}")
    result = await workflow.run_step(state, config)
    print(f"DEBUG: Scrape End - Result keys: {list(result.keys())}")
    if "product_data" in result:
        print(f"DEBUG: Found product_data in result")
    else:
        print(f"DEBUG: NO product_data in result! Error: {result.get('error')}")
    
    # Update session
    from datetime import datetime
    product_data = result.get("product_data")
    if product_data and product_data.get("title") and product_data.get("title") != "Unknown Product":
        result["thread_title"] = product_data.get("title")
    
    result["updated_at"] = datetime.now().isoformat()
    active_sessions[thread_id] = result
    save_sessions()
    
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
    state["current_step"] = "product-analysis"
    state["navigation_intent"] = "analyze"
    if request.feedback:
        state["analysis_feedback"].append(request.feedback)
        state["messages"].append({
            "role": "user",
            "content": request.feedback
        })
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    print(f"DEBUG: Analyze Start - Thread: {thread_id}, Product Data in state: {'Yes' if state.get('product_data') else 'No'}")
    result = await workflow.run_step(state, config)
    print(f"DEBUG: Analyze End - Error: {result.get('error')}")
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
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
    state["current_step"] = "script-selection"
    state["navigation_intent"] = "generate_scripts"
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
    save_sessions()
    
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
    state["current_step"] = "script-selection"
    state["navigation_intent"] = "select_script"
    state["selected_script_index"] = request.script_index
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
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
    state["current_step"] = "script-selection"
    state["navigation_intent"] = "refine_script"
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
    save_sessions()
    
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
    state["current_step"] = "creative-generation:images"
    state["navigation_intent"] = "generate_images"
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
    save_sessions()
    
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
    state["current_step"] = "creative-review"
    state["navigation_intent"] = "refine_images"
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
    save_sessions()
    
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
    state["current_step"] = "creative-generation:audio"
    state["navigation_intent"] = "generate_audio"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
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
    state["current_step"] = "avatar-selection"
    state["navigation_intent"] = "select_avatar"
    state["selected_avatar_id"] = request.avatar_id
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
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
        "avatars": state.get("available_avatars", [])[:9] # Limit to 9 as requested by user
    }

@app.post("/api/workflow/generate_video")
async def generate_video(request: GenerateVideoRequest):
    """Generate HeyGen video"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "creative-generation:video"
    state["navigation_intent"] = "generate_video"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
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

@app.get("/api/workflow/video_status/{video_id}")
async def get_video_status(video_id: str):
    """Check status of HeyGen video"""
    from heygen import HeyGenAvatarIntegrator
    heygen = HeyGenAvatarIntegrator()
    status = heygen.check_video_status(video_id)
    return status

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
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "error": result.get("error")
    }

@app.post("/api/workflow/chat")
async def chat(request: WorkflowRequest):
    """Chat-based editing with AI support for out-of-context queries"""
    print(f"\n{'='*60}")
    print(f"📨 CHAT REQUEST RECEIVED")
    print(f"Message: {request.message}")
    print(f"Thread ID: {request.thread_id}")
    print(f"{'='*60}\n")
    
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    if not request.message:
        raise HTTPException(status_code=400, detail="Message is required")
        
    config = {"configurable": {"thread_id": thread_id}}
    
    current_step = state.get("current_step", "product-url")
    
    # Add message to state
    state["messages"].append({
        "role": "user",
        "content": request.message
    })
    
    # STEP 1: Check if this is a navigation query or support query
    # support_service initialized globally
    support_service = get_support_service()
    
    intent_classification = await support_service.is_navigation_query(
        message=request.message,
        current_step=current_step
    )
    
    is_navigation = intent_classification.get("is_navigation", True)
    classification_reasoning = intent_classification.get("reasoning", "")
    
    print(f"🔍 Intent Classification: {'NAVIGATION' if is_navigation else 'SUPPORT'}")
    print(f"   Reasoning: {classification_reasoning}")
    print(f"   Confidence: {intent_classification.get('confidence', 0.0)}")
    
    # STEP 2: If it's a SUPPORT query, trigger help & support
    if not is_navigation:
        print(f"🆘 Triggering AI Support for query: {request.message}")
        
        # Get AI-powered support response
        support_response = await support_service.get_support_response(
            question=request.message,
            top_k=3
        )
        
        # Add support response to messages
        state["messages"].append({
            "role": "assistant",
            "content": support_response["answer"]
        })
        
        # Update session
        active_sessions[thread_id] = state
        save_sessions()
        
        response_data = {
            "thread_id": thread_id,
            "state": state,
            "message": support_response["answer"],
            "current_step": current_step,
            "is_support_response": True,
            "support_confidence": support_response.get("confidence", 0.0),
            "support_sources": support_response.get("sources", []),
            "suggested_actions": support_response.get("suggested_actions", []),
            "error": state.get("error")
        }
        
        print(f"\n{'='*60}")
        print(f"🆘 SUPPORT RESPONSE SENT")
        print(f"Answer: {support_response['answer'][:100]}...")
        print(f"Confidence: {support_response.get('confidence', 0.0)}")
        print(f"{'='*60}\n")
        
        return response_data
    
    # STEP 3: If it's NAVIGATION, proceed with normal navigation logic
    from agents import NavigationAgent
    
    # FAST PATH: Check for simple keywords to avoid LLM call
    message_lower = request.message.lower().strip()
    simple_intents = {
        "next": "next", "continue": "next", "proceed": "next", "forward": "next", "go": "next", "ok": "next", "okay": "next", "yes": "next",
        "back": "back", "previous": "back", "return": "back", "go back": "back"
    }
    
    if message_lower in simple_intents:
        navigation_intent = simple_intents[message_lower]
        reasoning = "Fast-path keyword match"
        print(f"🧭 Fast-path Navigation Intent: {navigation_intent}")
    else:
        navigation_agent = NavigationAgent()
        
        # Detect navigation intent using LLM (async)
        intent_result = await navigation_agent.analyze_intent(state)
        
        navigation_intent = intent_result.get("intent")
        reasoning = intent_result.get("reasoning", "")
        
        print(f"🧭 Detected Navigation Intent: {navigation_intent} - {reasoning}")
    
    # SMART NAVIGATION: Handle back/next WITHOUT re-executing
    step_order = [
        "product-url",
        "product-analysis",
        "script-selection",
        "creative-generation",
        "creative-generation:images",
        "creative-generation:audio",
        "avatar-selection",
        "creative-generation:video",
        "facebook-auth",
        "ad-account-selection",
        "page-selection",
        "campaign-creation"
    ]
    
    # Check if this is a simple back navigation OR direct step jump (Let "next" fall through to workflow for validation)
    if navigation_intent in ["back", "previous"] or navigation_intent in step_order:
        
        if navigation_intent in step_order:
            new_step = navigation_intent
        else:
            # Map internal step names to step_order names
            # Map internal step names to step_order names
            step_mapping = {
                "scrape": "product-url",
                "analyze": "product-analysis",
                "generate_scripts": "script-selection",
                "select_script": "script-selection",
                "refine_script": "script-selection",
                "generate_images": "creative-generation:images",
                "refine_images": "creative-generation:images",
                "generate_audio": "creative-generation:audio",
                "select_avatar": "avatar-selection",
                "generate_video": "creative-generation:video",
                "select_media": "creative-generation:video",
                "select_ad_account": "ad-account-selection",
                "select_page": "page-selection",
                "preview_campaign": "campaign-creation",
                "refine_campaign": "campaign-creation",
                "publish_campaign": "campaign-creation"
            }
            normalized_step = step_mapping.get(current_step, current_step)
            
            # Fallback if normalized step still not in order
            if normalized_step not in step_order:
                # Try to find partial match
                for s in step_order:
                    if s in normalized_step or normalized_step in s:
                        normalized_step = s
                        break
            
            current_index = step_order.index(normalized_step) if normalized_step in step_order else 0
            
            if navigation_intent in ["back", "previous"]:
                new_step = step_order[max(0, current_index - 1)]
                
                # If back takes us to the start, clear data to avoid "phantom" products appearing
                if new_step == "product-url":
                    state["url"] = None
                    state["product_data"] = None
                    state["analysis"] = None
                    state["scripts"] = None
                    state["selected_script"] = None
            else:  # next/continue
                new_step = step_order[min(len(step_order) - 1, current_index + 1)]
        
        # JUST NAVIGATE - Don't re-execute
        state["current_step"] = new_step
        state["navigation_intent"] = navigation_intent
        
        # Update session
        # CRITICAL: Sync changes to LangGraph checkpointer to ensure persistence and correct state for subsequent steps
        workflow.app.update_state(config, state)
        active_sessions[thread_id] = state
        save_sessions()
        
        # BUILD PROACTIVE RESPONSE WITH DATA
        if new_step == "product-analysis" and state.get("analysis"):
            # Show the analysis data
            analysis = state["analysis"]
            response_message = f"""Perfect! Here's your product analysis:

**Product**: {state.get('product_data', {}).get('title', 'Your product')}

**Target Audience**: {analysis.get('target_audience', 'Not analyzed yet')}

**Key USPs**: {', '.join(analysis.get('usps', [])[:3]) if analysis.get('usps') else 'Not analyzed yet'}

Ready to proceed?"""
            
        elif new_step == "script-selection" and state.get("scripts"):
            # Show summary only, UI handles display
            scripts = state["scripts"]
            response_message = f"""I've generated {len(scripts)} scripts for your campaign based on the product analysis.

You can review them in the panel on the right 👉"""
            
        elif new_step == "creative-generation" and state.get("generated_images"):
            # Show the creatives
            images = state["generated_images"]
            response_message = f"""Your creatives are ready!

✅ {len(images)} images generated
{'✅ Audio generated' if state.get('audio_file') else '⏳ Audio pending'}
{'✅ Video generated' if state.get('video_url') else '⏳ Video pending'}

Ready to review or generate more?"""
            
        elif new_step == "facebook-auth" and state.get("facebook_access_token"):
            # Show Facebook status
            response_message = f"""Facebook is connected!

✅ Access token active
{'✅ Ad accounts loaded' if state.get('ad_accounts') else '⏳ Loading ad accounts...'}

Ready to select your ad account?"""
            
        else:
            # No data yet - prompt to complete step
            step_names = {
                "product-url": "Enter your product URL to get started",
                "product-analysis": "Let me analyze your product",
                "script-selection": "Generate ad scripts",
                "creative-generation": "Create images and videos",
                "avatar-selection": "Choose an avatar",
                "facebook-auth": "Connect your Facebook account",
                "ad-account-selection": "Select your ad account",
                "page-selection": "Select your Facebook Page",
                "campaign-creation": "Configure your campaign"
            }
            response_message = step_names.get(new_step, f"Complete {new_step}")
        
        response_data = {
            "thread_id": thread_id,
            "state": state,
            "message": response_message,
            "current_step": new_step,
            "is_support_response": False,
            "navigation_intent": navigation_intent,
            "error": state.get("error")
        }
        
        print(f"\n{'='*60}")
        print(f"🚀 PROACTIVE NAVIGATION")
        print(f"From: {current_step} → To: {new_step}")
        print(f"Showing: Data + Actions")
        print(f"{'='*60}\n")
        
        return response_data
    
    # For other navigation intents, keep existing behavior
    state["navigation_intent"] = navigation_intent
    
    # DIRECT NAVIGATION - No options, just do it!
    if navigation_intent in ["start_over", "restart", "change_url", "new_url"]:
        # Reset to product-url step
        state["current_step"] = "product-url"
        state["url"] = None
        state["product_data"] = None
        state["analysis"] = None
        
        active_sessions[thread_id] = state
        save_sessions()
        
        response_data = {
            "thread_id": thread_id,
            "state": state,
            "message": "Ready for a new product! Paste your product URL below.",
            "current_step": "product-url",
            "is_support_response": False,
            "navigation_intent": navigation_intent,
            "error": None
        }
        
        print(f"\n{'='*60}")
        print(f"🔄 DIRECT NAVIGATION: Starting over")
        print(f"{'='*60}\n")
        
        return response_data
    
    # For go_to_step intents
    if navigation_intent.startswith("go_to_"):
        target_step = navigation_intent.replace("go_to_", "")
        if target_step in step_order:
            state["current_step"] = target_step
            active_sessions[thread_id] = state
            save_sessions()
            
            response_data = {
                "thread_id": thread_id,
                "state": state,
                "message": f"Navigated to {target_step.replace('-', ' ')}",
                "current_step": target_step,
                "is_support_response": False,
                "navigation_intent": navigation_intent,
                "error": None
            }
            
            return response_data
    
    # STEP 4: Fallback - Execute workflow for logic-based navigation (e.g. Scrape, Analyze)
    
    # Run the graph (this validates inputs and runs actual logic)
    print(f"⚙️ EXECUTING WORKFLOW for intent: {navigation_intent}")
    result = await workflow.run_step(state, config)
    
    # Update active session with result from graph
    active_sessions[thread_id] = result
    save_sessions()
    
    # Extract the last message from the result to show to user
    response_message = ""
    
    # 1. Check for explicit agent message from logic (e.g. route node)
    if result.get("agent_message"):
        response_message = result.get("agent_message")
        
    # 2. Check message history for AI response
    if not response_message and result.get("messages"):
        last_msg = result["messages"][-1]
        role = last_msg.get("role") if isinstance(last_msg, dict) else getattr(last_msg, "type", "unknown")
        content = last_msg.get("content") if isinstance(last_msg, dict) else getattr(last_msg, "content", "")
        
        if role in ["ai", "assistant"]:
            response_message = content

    # 3. If no AI response found (e.g. silent logic step), generate fresh guidance
    if not response_message: 
        print("🤖 Generating Post-Step Guidance...")
        try:
            response_message = await workflow.guide_agent.generate_guidance(result)
            # Add to history
            result["messages"].append({"role": "assistant", "content": response_message})
            active_sessions[thread_id] = result
            save_sessions()
        except Exception as e:
            print(f"Error generating guidance: {e}")
            response_message = "Step completed. What would you like to do next?"
    response_data = {
        "thread_id": thread_id,
        "state": result,
        "message": response_message,
        "current_step": result.get("current_step"),
        "is_support_response": False,
        "navigation_intent": navigation_intent,
        "error": result.get("error")
    }
    
    print(f"\n{'='*60}")
    print(f"✅ WORKFLOW EXECUTED")
    print(f"Step: {result.get('current_step')}")
    print(f"Message: {response_message[:100]}...")
    print(f"{'='*60}\n")
    
    return response_data

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

# --- Facebook Campaign Endpoints ---


@app.post("/api/workflow/facebook_auth")
async def facebook_auth(request: FacebookAuthRequest):
    """Authenticate with Facebook and get ad accounts"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    try:
        # Import the authentication function
        from facebook_agents import authenticate_user
        
        # Call Facebook Graph API to authenticate and get ad accounts
        auth_result = await authenticate_user(request.access_token)
        
        if not auth_result.get("success"):
            error_msg = auth_result.get("error", "Failed to authenticate with Facebook")
            state["error"] = error_msg
            state["current_step"] = "facebook_auth"
            active_sessions[thread_id] = state
            save_sessions()
            
            return {
                "thread_id": thread_id,
                "state": state,
                "current_step": "facebook_auth",
                "error": error_msg
            }
        
        # Store Facebook data in state
        state["facebook_user_id"] = auth_result.get("user_id")
        state["facebook_access_token"] = request.access_token
        state["ad_accounts"] = auth_result.get("ad_accounts", [])
        state["facebook_pages"] = auth_result.get("pages", [])
        
        # Default to first page if available
        if state["facebook_pages"] and not state.get("selected_page_id"):
            state["selected_page_id"] = state["facebook_pages"][0]["id"]
            
        state["current_step"] = "ad-account-selection"
        state["error"] = None
        
        # Update session
        active_sessions[thread_id] = state
        save_sessions()
        
        return {
            "thread_id": thread_id,
            "state": state,
            "current_step": state.get("current_step"),
            "facebook_user_id": state.get("facebook_user_id"),
            "ad_accounts": state.get("ad_accounts"),
            "error": None
        }
        
    except Exception as e:
        error_msg = f"Facebook authentication error: {str(e)}"
        print(f"ERROR: {error_msg}")
        state["error"] = error_msg
        state["current_step"] = "facebook_auth"
        active_sessions[thread_id] = state
        save_sessions()
        
        return {
            "thread_id": thread_id,
            "state": state,
            "current_step": "facebook_auth",
            "error": error_msg
        }


@app.post("/api/workflow/select_page")
async def select_page(request: dict):
    """Select Facebook Page"""
    thread_id = get_or_create_thread(request.get("thread_id"))
    state = active_sessions[thread_id]
    
    page_id = request.get("page_id")
    if not page_id:
        raise HTTPException(status_code=400, detail="page_id is required")
        
    # Update state
    state["selected_page_id"] = page_id
    
    # Update session
    from datetime import datetime
    state["updated_at"] = datetime.now().isoformat()
    active_sessions[thread_id] = state
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": state,
        "selected_page_id": page_id,
        "error": None
    }


@app.post("/api/workflow/select_ad_account")
async def select_ad_account(request: SelectAdAccountRequest):
    """Select Facebook Ad Account"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "select_ad_account"
    state["selected_ad_account_id"] = request.ad_account_id
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "selected_ad_account_id": result.get("selected_ad_account_id"),
        "error": result.get("error")
    }

@app.post("/api/workflow/select_media")
async def select_media(request: SelectMediaRequest):
    """Select media for the Facebook ad"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "select_media"
    state["selected_media"] = {
        "type": request.media_type,
        "url": request.media_url
    }
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "selected_media": result.get("selected_media"),
        "error": result.get("error")
    }

@app.post("/api/workflow/preview_campaign")
async def preview_campaign(request: WorkflowRequest):
    """Generate campaign preview"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "preview_campaign"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "campaign_config": result.get("campaign_config"),
        "campaign_preview": result.get("campaign_preview"),
        "error": result.get("error")
    }

@app.post("/api/workflow/refine_campaign")
async def refine_campaign(request: ReffineCampaignRequest):
    """Refine campaign configuration"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "refine_campaign"
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
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "campaign_config": result.get("campaign_config"),
        "campaign_preview": result.get("campaign_preview"),
        "error": result.get("error")
    }

@app.post("/api/workflow/publish_campaign")
async def publish_campaign(request: PublishCampaignRequest):
    """Publish campaign to Facebook"""
    thread_id = get_or_create_thread(request.thread_id)
    state = active_sessions[thread_id]
    
    # Update state
    state["current_step"] = "publish_campaign"
    state = update_state_from_request(state, request)
    
    # Run workflow step
    config = {"configurable": {"thread_id": thread_id}}
    result = await workflow.run_step(state, config)
    
    # Update session
    active_sessions[thread_id] = result
    save_sessions()
    
    return {
        "thread_id": thread_id,
        "state": result,
        "current_step": result.get("current_step"),
        "publish_status": result.get("publish_status"),
        "final_campaign_id": result.get("final_campaign_id"),
        "error": result.get("error")
    }

@app.get("/api/workflow/list_threads")
async def list_threads():
    """List all available chat threads"""
    threads = []
    for tid, state in active_sessions.items():
        threads.append({
            "id": tid,
            "title": state.get("thread_title", "New Campaign"),
            "updated_at": state.get("updated_at"),
            "current_step": state.get("current_step"),
            "has_product": state.get("product_data") is not None
        })
    
    # Sort by updated_at descending
    threads.sort(key=lambda x: x["updated_at"] or "", reverse=True)
    
    return {"threads": threads}

@app.delete("/api/workflow/delete_thread/{thread_id}")
async def delete_thread(thread_id: str):
    """Delete a chat thread"""
    if thread_id in active_sessions:
        del active_sessions[thread_id]
        save_sessions()
        return {"status": "success", "message": f"Thread {thread_id} deleted"}
    raise HTTPException(status_code=404, detail="Thread not found")

# --- AI Support Endpoints ---

@app.get("/api/support/health")
async def support_health():
    """Check AI support service health"""
    from support_service import get_support_service
    
    support_service = get_support_service()
    return {
        "status": "ok",
        "rag_available": support_service.rag_available
    }

@app.post("/api/support/query")
async def support_query(request: dict):
    """Direct support query endpoint for testing"""
    from support_service import get_support_service
    
    support_service = get_support_service()
    question = request.get("question", "")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    
    response = await support_service.get_support_response(
        question=question,
        top_k=3
    )
    
    return {
        "question": question,
        "answer": response["answer"],
        "confidence": response.get("confidence", 0.0),
        "sources": response.get("sources", []),
        "suggested_actions": response.get("suggested_actions", [])
    }


# Mount static files
from fastapi.staticfiles import StaticFiles
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

