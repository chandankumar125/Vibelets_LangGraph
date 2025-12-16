from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx

router = APIRouter(prefix="/management", tags=["Facebook Management"])

FB_API_URL = "https://graph.facebook.com/v24.0"

# --- Models ---

class CampaignUpdate(BaseModel):
    access_token: str
    name: Optional[str] = None
    status: Optional[str] = None  # PAUSED, ACTIVE, ARCHIVED
    objective: Optional[str] = None
    special_ad_categories: Optional[List[str]] = None

class AdSetUpdate(BaseModel):
    access_token: str
    name: Optional[str] = None
    status: Optional[str] = None
    daily_budget: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    targeting: Optional[Dict[str, Any]] = None

class AdUpdate(BaseModel):
    access_token: str
    name: Optional[str] = None
    status: Optional[str] = None

# --- Helper ---
async def make_fb_request(method: str, url: str, params: dict = None, json: dict = None):
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "GET":
            response = await client.get(url, params=params)
        else:
            response = await client.post(url, params=params, json=json)
            
        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Facebook API Error: {response.text}"
            )
        return response.json()

# --- Campaign Endpoints ---
@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, access_token: str):
    """Get Campaign Details"""
    fields = "id,name,status,objective,buying_type,special_ad_categories,start_time,stop_time"
    return await make_fb_request(
        "GET",
        f"{FB_API_URL}/{campaign_id}",
        params={"access_token": access_token, "fields": fields}
    )

@router.post("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, update: CampaignUpdate):
    """Update Campaign"""
    payload = {k: v for k, v in update.dict().items() if v is not None and k != "access_token"}
    if not payload:
        return {"message": "No changes provided"}
        
    return await make_fb_request(
        "POST",
        f"{FB_API_URL}/{campaign_id}",
        params={"access_token": update.access_token},
        json=payload
    )

# --- Ad Set Endpoints ---

@router.get("/adsets/{adset_id}")
async def get_ad_set(adset_id: str, access_token: str):
    """Get Ad Set Details"""
    fields = "id,name,status,daily_budget,lifetime_budget,start_time,end_time,targeting,billing_event,optimization_goal"
    return await make_fb_request(
        "GET",
        f"{FB_API_URL}/{adset_id}",
        params={"access_token": access_token, "fields": fields}
    )

@router.post("/adsets/{adset_id}")
async def update_ad_set(adset_id: str, update: AdSetUpdate):
    """Update Ad Set"""
    payload = {k: v for k, v in update.dict().items() if v is not None and k != "access_token"}
    if not payload:
        return {"message": "No changes provided"}
        
    return await make_fb_request(
        "POST",
        f"{FB_API_URL}/{adset_id}",
        params={"access_token": update.access_token},
        json=payload
    )

# --- Ad Endpoints ---

@router.get("/ads/{ad_id}")
async def get_ad(ad_id: str, access_token: str):
    """Get Ad Details"""
    fields = "id,name,status,creative{id,name,title,body},adset_id,campaign_id"
    return await make_fb_request(
        "GET",
        f"{FB_API_URL}/{ad_id}",
        params={"access_token": access_token, "fields": fields}
    )

@router.post("/ads/{ad_id}")
async def update_ad(ad_id: str, update: AdUpdate):
    """Update Ad"""
    payload = {k: v for k, v in update.dict().items() if v is not None and k != "access_token"}
    if not payload:
        return {"message": "No changes provided"}
        
    return await make_fb_request(
        "POST",
        f"{FB_API_URL}/{ad_id}",
        params={"access_token": update.access_token},
        json=payload
    )
