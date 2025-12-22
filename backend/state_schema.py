"""
State schema for LangGraph workflow
Defines the complete state that persists across all steps
"""
from typing import TypedDict, List, Dict, Optional, Any, Literal
from langgraph.graph.message import add_messages


class WorkflowState(TypedDict):
    """Complete state for the ad campaign generation workflow"""
    
    # Current step in the workflow
    current_step: Literal[
        "scrape",
        "analyze", 
        "generate_scripts",
        "select_script",
        "refine_script",
        "generate_images",
        "refine_images",
        "generate_audio",
        "select_avatar",
        "generate_video",
        "complete"
    ]
    
    # Navigation intent (where user wants to go)
    navigation_intent: Optional[str]
    
    # Guide Agent message
    agent_message: Optional[str]
    
    # User messages/feedback for chat-based editing
    messages: List[Dict[str, Any]]
    
    # Step 1: Scraping
    url: Optional[str]
    scraped_url: Optional[str]
    product_data: Optional[Dict[str, Any]]
    selected_product: Optional[Dict[str, Any]]
    
    # Step 2: Analysis
    analysis: Optional[Dict[str, Any]]
    analysis_feedback: List[str]  # History of feedback for analysis
    
    # Step 3: Scripts
    scripts: Optional[List[str]]  # All 3 generated scripts
    script_feedback: List[str]  # History of feedback for scripts
    
    # Step 4: Selected Script
    selected_script_index: Optional[int]
    selected_script: Optional[str]
    script_refinement_feedback: List[str]  # History of refinements
    
    # Step 5: Images
    generated_images: Optional[List[str]]  # URLs of generated images
    image_feedback: List[str]  # History of feedback for images
    image_generation_prompt: Optional[str]  # Current prompt used for images
    
    # Step 6: Audio
    audio_file: Optional[str]  # Path to generated audio
    audio_url: Optional[str]  # Public URL if uploaded
    
    # Step 7: Avatar
    available_avatars: Optional[List[Dict[str, Any]]]
    selected_avatar_id: Optional[str]
    
    # Step 8: Video
    video_id: Optional[str]
    video_url: Optional[str]
    video_status: Optional[str]
    video_aspect_ratio: Optional[str] # e.g., '9:16', '1:1', '4:5', '1.91:1'
    
    # Error handling
    error: Optional[str]
    
    # Metadata
    iteration_count: Dict[str, int]  # Track iterations per step

    # Facebook Integration
    facebook_access_token: Optional[str]
    facebook_user_id: Optional[str]
    ad_accounts: Optional[List[Dict[str, Any]]]
    selected_ad_account_id: Optional[str]
    selected_media: Optional[Dict[str, Any]]  # {id, type, url}
    campaign_config: Optional[Dict[str, Any]]
    campaign_preview: Optional[str]
    publish_status: Optional[str]

