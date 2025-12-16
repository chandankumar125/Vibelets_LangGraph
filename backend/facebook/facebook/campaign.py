"""
Facebook Campaign Module
Handles campaign creation and publishing to Facebook
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import httpx
import uuid

router = APIRouter(prefix="/publish", tags=["Campaign Publishing"])

FB_API_URL = "https://graph.facebook.com/v24.0"


class CampaignPublishRequest(BaseModel):
    campaign_data: Dict[str, Any]
    access_token: str
    ad_account_id: str
    page_id: str
    media_id: str
    media_type: str  # 'image' or 'video'
    objective: Optional[str] = "OUTCOME_TRAFFIC"
    budget: Optional[int] = 20000  # Increased for safety (e.g., ~$20 or ₹200) to meet minimums
    targeting: Optional[Dict[str, Any]] = None


class CampaignPublishResponse(BaseModel):
    success: bool
    campaign_id: str
    adset_id: str
    ad_id: str
    creative_id: str
    message: str


@router.post("", response_model=CampaignPublishResponse)
async def publish_campaign(request: CampaignPublishRequest):
    """
    Create and publish a complete Facebook ad campaign
    
    Steps:
    1. Create Campaign
    2. Create Ad Set
    3. Create Ad Creative
    4. Create Ad
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            
            # Extract campaign data
            print(f"🚀 STARTING PUBLISH PROCESS")
            print(f"Account: {request.ad_account_id}")
            print(f"Page: {request.page_id}")
            print(f"Media: {request.media_id} ({request.media_type})")
            
            headline = request.campaign_data.get("headline", "")
            ad_copy = request.campaign_data.get("ad_copy", "")
            campaign_name = f"Campaign - {headline[:30]}"
            
            # Step 1: Create Campaign
            campaign_response = await client.post(
                f"{FB_API_URL}/act_{request.ad_account_id}/campaigns",
                params={"access_token": request.access_token},
                json={
                    "name": campaign_name,
                    "objective": request.objective,
                    "status": "PAUSED",
                    "special_ad_categories": [],
                    # Explicitly disable CBO to use AdSet level budgets
                    "is_adset_budget_sharing_enabled": False
                }
            )
            
            if campaign_response.status_code not in [200, 201]:
                print(f"❌ FAILED TO CREATE CAMPAIGN")
                print(f"Status: {campaign_response.status_code}")
                print(f"Response: {campaign_response.text}")
                raise HTTPException(
                    status_code=campaign_response.status_code,
                    detail=f"Failed to create campaign: {campaign_response.text}"
                )
            
            campaign_data = campaign_response.json()
            print(f"✅ Campaign Created: {campaign_data.get('id')}")
            campaign_id = campaign_data.get("id")
            
            # Step 2: Create Ad Set
            # Default targeting if not provided
            targeting = request.targeting or {
                "geo_locations": {"countries": ["US"]},
                "age_min": 18,
                "age_max": 65
            }
            
            adset_response = await client.post(
                f"{FB_API_URL}/act_{request.ad_account_id}/adsets",
                params={"access_token": request.access_token},
                json={
                    "name": f"AdSet - {headline[:30]}",
                    "campaign_id": campaign_id,
                    "daily_budget": request.budget,
                    "billing_event": "IMPRESSIONS",
                    "optimization_goal": "REACH",
                    "bid_amount": 100,
                    "targeting": targeting,
                    "status": "PAUSED"
                }
            )
            
            if adset_response.status_code not in [200, 201]:
                print(f"❌ FAILED TO CREATE AD SET")
                print(f"Status: {adset_response.status_code}")
                print(f"Response: {adset_response.text}")
                raise HTTPException(
                    status_code=adset_response.status_code,
                    detail=f"Failed to create ad set: {adset_response.text}"
                )
            
            adset_data = adset_response.json()
            print(f"✅ Ad Set Created: {adset_data.get('id')}")
            adset_id = adset_data.get("id")
            
            # Step 3: Create Ad Creative
            if request.media_type == "image":
                creative_payload = {
                    "name": f"Creative - {headline[:30]}",
                    "object_story_spec": {
                        "page_id": request.page_id,
                        "link_data": {
                            "image_hash": request.media_id,
                            "link": "https://www.facebook.com",  # Default link
                            "message": ad_copy,
                            "name": headline,
                            "call_to_action": {
                                "type": "LEARN_MORE"
                            }
                        }
                    }
                }
            else:  # video
                creative_payload = {
                    "name": f"Creative - {headline[:30]}",
                    "object_story_spec": {
                        "page_id": request.page_id,
                        "video_data": {
                            "video_id": request.media_id,
                            "title": headline,
                            "message": ad_copy,
                            "call_to_action": {
                                "type": "LEARN_MORE",
                                "value": {
                                    "link": "https://www.facebook.com"
                                }
                            }
                        }
                    }
                }
            
            creative_response = await client.post(
                f"{FB_API_URL}/act_{request.ad_account_id}/adcreatives",
                params={"access_token": request.access_token},
                json=creative_payload
            )
            
            if creative_response.status_code not in [200, 201]:
                print(f"❌ FAILED TO CREATE AD CREATIVE")
                error_data = creative_response.json()
                error_details = error_data.get("error", {})
                print(f"Status: {creative_response.status_code}")
                print(f"Response: {creative_response.text}")
                
                # Check for App Mode error
                if error_details.get("error_subcode") == 1885183:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Facebook App is in Development Mode. "
                            "You must switch your App to 'Live' mode in the Facebook App Dashboard "
                            "(Settings > Basic > Switch toggle to Live) to create ad creatives."
                        )
                    )
                
                raise HTTPException(
                    status_code=creative_response.status_code,
                    detail=f"Failed to create ad creative: {creative_response.text}"
                )
            
            creative_data = creative_response.json()
            creative_id = creative_data.get("id")
            
            # Step 4: Create Ad
            ad_response = await client.post(
                f"{FB_API_URL}/act_{request.ad_account_id}/ads",
                params={"access_token": request.access_token},
                json={
                    "name": f"Ad - {headline[:30]}",
                    "adset_id": adset_id,
                    "creative": {"creative_id": creative_id},
                    "status": "PAUSED"
                }
            )
            
            if ad_response.status_code not in [200, 201]:
                raise HTTPException(
                    status_code=ad_response.status_code,
                    detail=f"Failed to create ad: {ad_response.text}"
                )
            
            ad_data = ad_response.json()
            ad_id = ad_data.get("id")
            print(f"✅ Ad Created: {ad_id}")
            
            success_message = (
                f"Campaign Published Successfully!\n"
                f"Campaign ID: {campaign_id}\n"
                f"Ad Set ID: {adset_id}\n"
                f"Ad ID: {ad_id}\n"
                f"Status: PAUSED"
            )
            
            return CampaignPublishResponse(
                success=True,
                campaign_id=campaign_id,
                adset_id=adset_id,
                ad_id=ad_id,
                creative_id=creative_id,
                message=success_message
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publishing error: {str(e)}")


@router.get("/campaign/{campaign_id}/status")
async def get_campaign_status(campaign_id: str, access_token: str):
    """
    Get the status of a published campaign
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FB_API_URL}/{campaign_id}",
                params={
                    "access_token": access_token,
                    "fields": "id,name,status,objective,created_time"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch campaign: {response.text}"
                )
            
            return response.json()
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")
