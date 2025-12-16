"""
Agent Router
FastAPI endpoints for AI agent interactions
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from agent.campaign_agent import generate_campaign

router = APIRouter(prefix="/agent", tags=["AI Agent"])


class CampaignPreviewRequest(BaseModel):
    campaign_id: Optional[str] = None
    user_instructions: str = ""
    objective: Optional[str] = "engagement"
    target_audience: Optional[str] = "general audience"
    
    # Campaign
    campaign_name: Optional[str] = None
    
    # Ad Set
    ad_set_name: Optional[str] = None
    daily_budget: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    audience_location: Optional[str] = None
    audience_age: Optional[str] = None
    audience_gender: Optional[str] = None
    placements: Optional[str] = None
    
    # Ad
    ad_name: Optional[str] = None
    headline: Optional[str] = None
    primary_text: Optional[str] = None
    ad_copy: Optional[str] = None # Legacy support
    description: Optional[str] = None
    call_to_action: Optional[str] = None
    destination_url: Optional[str] = None
    creative_description: Optional[str] = None
    messages: Optional[List[str]] = None
    thread_id: Optional[str] = None


@router.post("/preview")
async def create_or_modify_campaign(request: CampaignPreviewRequest):
    """
    Generate new campaign content or modify existing campaign based on user instructions
    """
    try:
        # Prepare existing state if this is a modification
        existing_state = None
        # Check if we have modification (if we have a thread_id or messages)
        if request.thread_id or request.messages:
            from langchain_core.messages import HumanMessage, AIMessage
            
            # Reconstruct messages from the messages list
            messages = []
            if request.messages:
                for msg in request.messages:
                    if msg.startswith("User:"):
                        messages.append(HumanMessage(content=msg.replace("User:", "").strip()))
                    elif msg.startswith("Agent:"):
                        messages.append(AIMessage(content=msg.replace("Agent:", "").strip()))
            
            existing_state = {
                "messages": messages,
                "campaign_id": request.campaign_id or request.thread_id,
                "user_instructions": request.user_instructions,
                "objective": request.objective or "engagement",
                "campaign_name": request.campaign_name or "",
                "ad_set_name": request.ad_set_name or "",
                "daily_budget": request.daily_budget or "",
                "start_time": request.start_time or "",
                "end_time": request.end_time or "",
                "audience_location": request.audience_location or "",
                "audience_age": request.audience_age or "",
                "audience_gender": request.audience_gender or "",
                "placements": request.placements or "",
                "ad_name": request.ad_name or "",
                "headline": request.headline or "",
                "primary_text": request.primary_text or request.ad_copy or "",
                "description": request.description or "",
                "call_to_action": request.call_to_action or "",
                "destination_url": request.destination_url or "",
                "creative_description": request.creative_description or ""
            }
        
        # Generate or modify campaign
        result = await generate_campaign(
            campaign_id=request.campaign_id or request.thread_id,
            user_instructions=request.user_instructions,
            objective=request.objective or "engagement",
            target_audience=request.target_audience or "general audience",
            existing_state=existing_state
        )
        
        return {"data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")
