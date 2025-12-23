"""
Facebook Campaign Module
Handles campaign creation and publishing to Facebook
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import httpx
from config import Config
import uuid
import csv
import io
import re
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/publish", tags=["Campaign Publishing"])

FB_API_URL = Config.FB_API_URL


class CampaignPublishRequest(BaseModel):
    access_token: str
    ad_account_id: str
    page_id: str
    # Media info
    media_id: str
    media_type: str  # 'image' or 'video'
    # Campaign details
    campaign_name: Optional[str] = None
    objective: Optional[str] = "OUTCOME_TRAFFIC"
    buying_type: Optional[str] = "AUCTION"
    special_ad_categories: Optional[List[str]] = []
    # Ad Set details
    adset_name: Optional[str] = None
    conversion_location: Optional[str] = "WEBSITE" # WEBSITE, INSTANT_FORM, etc.
    daily_budget: Optional[int] = None
    lifetime_budget: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    targeting: Optional[Dict[str, Any]] = None
    optimization_goal: Optional[str] = "LINK_CLICKS"
    billing_event: Optional[str] = "IMPRESSIONS"
    bid_strategy: Optional[str] = "LOWEST_COST_WITHOUT_CAP"
    bid_amount: Optional[int] = None
    performance_goal: Optional[str] = None
    beneficiary: Optional[str] = None
    payer: Optional[str] = None
    # Ad details
    ad_name: Optional[str] = None
    headline: Optional[str] = ""
    ad_copy: Optional[str] = ""
    link_url: Optional[str] = "https://www.facebook.com"
    call_to_action: Optional[str] = "LEARN_MORE"
    instagram_account_id: Optional[str] = None
    thumbnail_hash: Optional[str] = None
    thumbnail_url: Optional[str] = None
    advantage_plus_creative: Optional[Dict[str, Any]] = None
    partnership_ad: Optional[bool] = False
    # Statuses
    campaign_status: Optional[str] = "PAUSED"
    adset_status: Optional[str] = "PAUSED"
    ad_status: Optional[str] = "PAUSED"


class CampaignPublishResponse(BaseModel):
    success: bool
    campaign_id: str
    adset_id: str
    ad_id: str
    creative_id: Optional[str] = None
    message: Optional[str] = None


async def create_campaign_helper(
    client: httpx.AsyncClient,
    access_token: str,
    ad_account_id: str,
    page_id: str,
    # Content / Creative
    headline: str,
    ad_copy: str,
    media_id: str, # Image Hash or Video ID
    media_type: str,
    link_url: str = "https://www.facebook.com",
    call_to_action: str = "LEARN_MORE",
    instagram_account_id: str = None,
    advantage_plus_creative: dict = None,
    partnership_ad: bool = False,
    # Thumbnail for video
    thumbnail_hash: str = None,
    thumbnail_url: str = None,
    # Campaign details
    campaign_name: str = None,
    objective: str = "OUTCOME_TRAFFIC",
    special_ad_categories: list = [],
    campaign_status: str = "PAUSED",
    buying_type: str = "AUCTION",
    # Ad Set details
    adset_name: str = None,
    daily_budget: int = None,
    lifetime_budget: int = None,
    targeting: dict = None,
    adset_status: str = "PAUSED",
    bid_strategy: str = "LOWEST_COST_WITHOUT_CAP",
    billing_event: str = "IMPRESSIONS",
    optimization_goal: str = "LINK_CLICKS",
    bid_amount: int = None,
    promoted_object: dict = None,
    start_time: str = None,
    end_time: str = None,
    beneficiary: str = None,
    payer: str = None,
    # Ad details
    ad_name: str = None,
    ad_status: str = "PAUSED"
):
    def extract_error(response):
        try:
            data = response.json()
            error = data.get("error", {})
            return error.get("error_user_msg") or error.get("message") or response.text
        except:
            return response.text

    # Ensure sensible defaults
    campaign_name = campaign_name or f"Campaign {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    adset_name = adset_name or f"AdSet {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    ad_name = ad_name or f"Ad {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    
    print(f"🚀 STARTING CAMPAIGN CREATION: {campaign_name}")
    
    results = {
        "campaign_id": None,
        "adset_id": None,
        "creative_id": None,
        "ad_id": None
    }
    
    # Step 1: Create Campaign
    campaign_payload = {
        "name": campaign_name,
        "objective": objective,
        "status": campaign_status,
        "special_ad_categories": special_ad_categories,
        "buying_type": buying_type,
        "is_adset_budget_sharing_enabled": False
    }
    
    campaign_response = await client.post(
        f"{FB_API_URL}/act_{ad_account_id}/campaigns",
        params={"access_token": access_token},
        json=campaign_payload
    )
    
    if campaign_response.status_code not in [200, 201]:
        err_detail = extract_error(campaign_response)
        print(f"❌ FAILED TO CREATE CAMPAIGN: {err_detail}")
        return results, f"Failed to create campaign: {err_detail}"
    
    campaign_id = campaign_response.json().get("id")
    results["campaign_id"] = campaign_id
    print(f"✅ Campaign Created: {campaign_id}")
    
    # Step 2: Create Ad Set
    targeting = targeting or {
        "geo_locations": {"countries": ["US"]},
        "age_min": 18,
        "age_max": 65
    }
    
    adset_payload = {
        "name": adset_name,
        "campaign_id": campaign_id,
        "billing_event": billing_event,
        "optimization_goal": optimization_goal,
        "bid_strategy": bid_strategy,
        "targeting": targeting,
        "status": adset_status
    }

    if promoted_object:
        adset_payload["promoted_object"] = promoted_object
    
    if start_time:
        adset_payload["start_time"] = start_time
    if end_time:
        adset_payload["end_time"] = end_time
    
    if beneficiary:
        adset_payload["ad_beneficiary"] = beneficiary
    if payer:
        adset_payload["ad_payer"] = payer
    
    if bid_amount and bid_strategy not in ["LOWEST_COST_WITHOUT_CAP"]:
        adset_payload["bid_amount"] = bid_amount
    
    if lifetime_budget:
        adset_payload["lifetime_budget"] = lifetime_budget
    elif daily_budget:
        adset_payload["daily_budget"] = daily_budget
    else:
        adset_payload["daily_budget"] = 1000 # Default $10

    adset_response = await client.post(
        f"{FB_API_URL}/act_{ad_account_id}/adsets",
        params={"access_token": access_token},
        json=adset_payload
    )
    
    if adset_response.status_code not in [200, 201]:
        err_detail = extract_error(adset_response)
        print(f"❌ FAILED TO CREATE AD SET: {err_detail}")
        return results, f"Failed to create ad set: {err_detail}"
    
    adset_id = adset_response.json().get("id")
    results["adset_id"] = adset_id
    print(f"✅ Ad Set Created: {adset_id}")
    
    # Step 3: Create Ad Creative
    cta_type = call_to_action.upper().replace(" ", "_").replace("(", "").replace(")", "")
    valid_ctas = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "APPLY_NOW", "BOOK_NOW", "NO_BUTTON"]
    if cta_type not in valid_ctas:
        cta_type = "LEARN_MORE"

    object_story_spec = {"page_id": page_id}
    if instagram_account_id:
        object_story_spec["instagram_actor_id"] = instagram_account_id

    if media_type == "image":
        object_story_spec["link_data"] = {
            "image_hash": media_id,
            "link": link_url,
            "message": ad_copy,
            "name": headline,
            "call_to_action": {"type": cta_type}
        }
    else:  # video
        video_data = {
            "video_id": media_id,
            "title": headline,
            "message": ad_copy,
            "call_to_action": {
                "type": cta_type,
                "value": {"link": link_url}
            }
        }
        if thumbnail_hash: video_data["image_hash"] = thumbnail_hash
        elif thumbnail_url: video_data["image_url"] = thumbnail_url
        object_story_spec["video_data"] = video_data

    creative_payload = {
        "name": f"Creative - {headline[:30]}",
        "object_story_spec": object_story_spec
    }

    creative_response = await client.post(
        f"{FB_API_URL}/act_{ad_account_id}/adcreatives",
        params={"access_token": access_token},
        json=creative_payload
    )
    
    if creative_response.status_code not in [200, 201]:
        err_detail = extract_error(creative_response)
        print(f"❌ FAILED TO CREATE AD CREATIVE: {err_detail}")
        return results, f"Failed to create ad creative: {err_detail}"
    
    creative_id = creative_response.json().get("id")
    results["creative_id"] = creative_id
    print(f"✅ Ad Creative Created: {creative_id}")
    
    # Step 4: Create Ad
    ad_response = await client.post(
        f"{FB_API_URL}/act_{ad_account_id}/ads",
        params={"access_token": access_token},
        json={
            "name": ad_name,
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": ad_status
        }
    )
    
    if ad_response.status_code not in [200, 201]:
        err_detail = extract_error(ad_response)
        print(f"❌ FAILED TO CREATE AD: {err_detail}")
        return results, f"Failed to create ad: {err_detail}"
    
    ad_res_data = ad_response.json()
    ad_id = ad_res_data.get("id")
    results["ad_id"] = ad_id
    
    if not ad_id:
        err_detail = extract_error(ad_response)
        print(f"⚠️  WARNING: Ad created but no ID returned. Detail: {err_detail}")
        return results, f"Ad creation incomplete: {err_detail}"
        
    print(f"✅ Ad Created: {ad_id}")
    
    return results, None


@router.post("", response_model=CampaignPublishResponse)
async def publish_campaign(request: CampaignPublishRequest):
    """
    Create and publish a complete Facebook ad campaign
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Handle start_time / end_time safety
            start_time = request.start_time
            end_time = request.end_time
            
            now = datetime.now(timezone.utc)
            
            # Helper to parse and ensure ISO format with time
            def format_fb_time(time_str, default_now=False):
                if not time_str:
                    return (now + timedelta(minutes=10)).isoformat() if default_now else None
                try:
                    # If just a date YYYY-MM-DD
                    if len(time_str) == 10:
                        dt = datetime.strptime(time_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        # If midnight today is in the past, move to now + 10 mins
                        if dt < now:
                            dt = now + timedelta(minutes=10)
                        return dt.isoformat()
                    return time_str # Assume already valid ISO
                except:
                    return time_str

            safe_start = format_fb_time(start_time, default_now=True)
            safe_end = format_fb_time(end_time)

            # Daily budget 24h rule check
            if request.daily_budget and safe_start and safe_end:
                try:
                    s_dt = datetime.fromisoformat(safe_start.replace('Z', '+00:00'))
                    e_dt = datetime.fromisoformat(safe_end.replace('Z', '+00:00'))
                    if (e_dt - s_dt).total_seconds() < 86400: # 24 hours
                        # Extend end time slightly to satisfy Meta
                        safe_end = (s_dt + timedelta(hours=25)).isoformat()
                except:
                    pass

            # Handle promoted_object based on conversion_location
            promoted_object = None
            if request.conversion_location == "INSTANT_FORM":
                promoted_object = {"page_id": request.page_id}
            elif request.conversion_location == "WEBSITE":
                # Website usually requires a pixel or just handles it via link_url
                pass
            
            result, error_msg = await create_campaign_helper(
                client=client,
                access_token=request.access_token,
                ad_account_id=request.ad_account_id,
                page_id=request.page_id,
                headline=request.headline,
                ad_copy=request.ad_copy,
                media_id=request.media_id,
                media_type=request.media_type,
                link_url=request.link_url,
                call_to_action=request.call_to_action,
                instagram_account_id=request.instagram_account_id,
                thumbnail_hash=request.thumbnail_hash,
                thumbnail_url=request.thumbnail_url,
                advantage_plus_creative=request.advantage_plus_creative,
                partnership_ad=request.partnership_ad,
                campaign_name=request.campaign_name,
                objective=request.objective,
                buying_type=request.buying_type,
                special_ad_categories=request.special_ad_categories,
                campaign_status=request.campaign_status,
                adset_name=request.adset_name,
                adset_status=request.adset_status,
                daily_budget=request.daily_budget,
                lifetime_budget=request.lifetime_budget,
                targeting=request.targeting,
                optimization_goal=request.optimization_goal,
                billing_event=request.billing_event,
                bid_strategy=request.bid_strategy,
                bid_amount=request.bid_amount,
                promoted_object=promoted_object,
                start_time=safe_start,
                end_time=safe_end,
                beneficiary=request.beneficiary,
                payer=request.payer,
                ad_name=request.ad_name,
                ad_status=request.ad_status
            )
            
            success = True
            if error_msg:
                success = False
            elif not result["ad_id"]:
                success = False
                error_msg = "Ad creation incomplete (missing Ad ID)"

            return CampaignPublishResponse(
                success=success,
                campaign_id=result["campaign_id"] or "",
                adset_id=result["adset_id"] or "",
                ad_id=result["ad_id"] or "",
                creative_id=result["creative_id"] or "",
                message=f"Campaign created successfully!" if success else f"Error: {error_msg}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR IN PUBLISHING: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Publishing error: {str(e)}")


@router.post("/csv-launch")
async def launch_campaign_from_csv(
    access_token: str = Form(...),
    ad_account_id: str = Form(...),
    page_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload a CSV file to launch one or multiple campaigns.
    Supports standard Facebook Export columns.
    """
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        
        try:
            dialect = csv.Sniffer().sniff(decoded[:4096])
            delimiter = dialect.delimiter
        except:
            delimiter = ','
            
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
        
        results = []
        errors = []
        
        OBJECTIVE_MAP = {
            "TRAFFIC": "OUTCOME_TRAFFIC",
            "SALES": "OUTCOME_SALES",
            "LEADS": "OUTCOME_LEADS",
            "ENGAGEMENT": "OUTCOME_ENGAGEMENT",
            "AWARENESS": "OUTCOME_AWARENESS",
            "APP_PROMOTION": "OUTCOME_APP_PROMOTION",
            "CONVERSIONS": "OUTCOME_SALES",
            "CATALOG_SALES": "OUTCOME_SALES",
            "MESSAGES": "OUTCOME_ENGAGEMENT",
            "VIDEO_VIEWS": "OUTCOME_ENGAGEMENT",
            "BRAND_AWARENESS": "OUTCOME_AWARENESS",
            "REACH": "OUTCOME_AWARENESS",
            "STORE_TRAFFIC": "OUTCOME_SALES",
            "APP_INSTALLS": "OUTCOME_APP_PROMOTION",
            "LINK_CLICKS": "OUTCOME_TRAFFIC" 
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            for i, row in enumerate(csv_reader):
                row_idx = i + 1
                try:
                    # Utility to clean fields
                    def clean(val):
                        if val is None: return None
                        s = str(val).strip()
                        return s if s else None

                    # 1. Creative Content
                    headline = clean(row.get("Title") or row.get("headline") or row.get("Ad Name") or "Untitled Ad")
                    ad_copy = clean(row.get("Body") or row.get("ad_copy") or row.get("Link Description") or row.get("Message") or "")
                    link_url = clean(row.get("Link") or row.get("Website URL") or row.get("Display Link") or "https://www.facebook.com")
                    call_to_action = clean(row.get("Call to Action")) or "LEARN_MORE"

                    # 2. Media Extraction
                    image_hash = clean(row.get("Image Hash") or row.get("media_id"))
                    video_id = clean(row.get("Video ID"))
                    
                    if video_id and video_id.startswith('v:'):
                        video_id = video_id.replace('v:', '')

                    thumbnail_hash = clean(row.get("Video Thumbnail Hash") or image_hash)
                    thumbnail_url = clean(row.get("Video Thumbnail URL"))

                    if video_id:
                        media_id = video_id
                        media_type = "video"
                    elif image_hash:
                        media_id = image_hash
                        media_type = "image"
                    else:
                        raise Exception("Missing Media: Provide 'Image Hash' or 'Video ID'")

                    # 3. Identity
                    final_page_id = clean(row.get("Campaign Page ID") or row.get("Page ID")) or page_id
                    instagram_id = clean(row.get("Instagram Account ID"))

                    # 4. Campaign Parameters
                    campaign_name = clean(row.get("Campaign Name")) or f"Campaign - {headline[:20]}"
                    raw_objective = clean(row.get("Campaign Objective")) or "OUTCOME_TRAFFIC"
                    clean_obj = raw_objective.upper().replace(" ", "_")
                    objective = OBJECTIVE_MAP.get(clean_obj) or (clean_obj if clean_obj in OBJECTIVE_MAP.values() else "OUTCOME_TRAFFIC")
                    
                    campaign_status = clean(row.get("Campaign Status")) or "PAUSED"
                    buying_type = clean(row.get("Buying Type")) or "AUCTION"
                    
                    special_cats_str = clean(row.get("Special Ad Categories")) or ""
                    special_ad_categories = []
                    if special_cats_str and special_cats_str.upper() != "NONE":
                        special_ad_categories = [c.strip() for c in special_cats_str.split(',')]

                    # 5. Ad Set Parameters
                    adset_name = clean(row.get("Ad Set Name")) or f"AdSet - {headline[:20]}"
                    adset_status = clean(row.get("Ad Set Run Status") or row.get("Ad Set Status")) or "PAUSED"
                    
                    opt_goal_raw = (clean(row.get("Optimization Goal")) or "LINK_CLICKS").upper().replace(" ", "_")
                    valid_goals = ["LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS", "POST_ENGAGEMENT", "THRUPLAY", "VALUE", "CONVERSIONS"]
                    optimization_goal = opt_goal_raw if opt_goal_raw in valid_goals else "LINK_CLICKS"

                    bill_event_raw = (clean(row.get("Billing Event")) or "IMPRESSIONS").upper()
                    billing_event = bill_event_raw if bill_event_raw in ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"] else "IMPRESSIONS"

                    bid_strat_raw = (clean(row.get("Ad Set Bid Strategy")) or "").upper().replace(" ", "_")
                    if "LOWEST_COST" in bid_strat_raw and "WITHOUT_CAP" in bid_strat_raw:
                        bid_strategy = "LOWEST_COST_WITHOUT_CAP"
                    elif "COST_CAP" in bid_strat_raw:
                        bid_strategy = "COST_CAP"
                    elif "BID_CAP" in bid_strat_raw:
                        bid_strategy = "LOWEST_COST_WITH_BID_CAP"
                    else:
                        bid_strategy = "LOWEST_COST_WITHOUT_CAP"

                    def parse_val(v):
                        if not v: return None
                        digits = ''.join(filter(str.isdigit, str(v)))
                        return int(digits) if digits else None

                    bid_amount = parse_val(row.get("Bid Amount"))
                    daily_budget = parse_val(row.get("Ad Set Daily Budget") or row.get("Campaign Daily Budget"))
                    lifetime_budget = parse_val(row.get("Ad Set Lifetime Budget") or row.get("Campaign Lifetime Budget"))
                    
                    if not daily_budget and not lifetime_budget:
                        daily_budget = 100000 

                    # 6. Targeting
                    countries_str = clean(row.get("Countries")) or "US"
                    countries = [c.strip() for c in countries_str.split(',')]
                    
                    age_min = int(clean(row.get("Age Min")) or 18)
                    age_max = int(clean(row.get("Age Max")) or 65)
                    
                    custom_targeting = {
                        "geo_locations": {"countries": countries},
                        "age_min": age_min,
                        "age_max": age_max
                    }
                    
                    gender_raw = (clean(row.get("Gender")) or "").lower()
                    if "male" in gender_raw and "female" not in gender_raw:
                        custom_targeting["genders"] = [1]
                    elif "female" in gender_raw:
                        custom_targeting["genders"] = [2]
                    
                    # 7. Ad Status
                    ad_name = clean(row.get("Ad Name")) or f"Ad - {headline[:20]}"
                    ad_status = clean(row.get("Ad Status")) or "PAUSED"

                    # 8. Execution
                    res_data, err_msg = await create_campaign_helper(
                        client=client, access_token=access_token, ad_account_id=ad_account_id, page_id=final_page_id,
                        headline=headline, ad_copy=ad_copy, media_id=media_id, media_type=media_type,
                        link_url=link_url, call_to_action=call_to_action, instagram_account_id=instagram_id,
                        thumbnail_hash=thumbnail_hash, thumbnail_url=thumbnail_url,
                        campaign_name=campaign_name, objective=objective, special_ad_categories=special_ad_categories,
                        campaign_status=campaign_status, buying_type=buying_type,
                        adset_name=adset_name, daily_budget=daily_budget, lifetime_budget=lifetime_budget,
                        targeting=custom_targeting, adset_status=adset_status,
                        bid_strategy=bid_strategy, billing_event=billing_event, optimization_goal=optimization_goal,
                        bid_amount=bid_amount, ad_name=ad_name, ad_status=ad_status
                    )
                    if err_msg:
                        errors.append(f"Row {row_idx} partial failure: {err_msg}")
                    results.append(res_data)
                    
                except Exception as e:
                    errors.append(f"Row {row_idx} critical error: {str(e)}")
                    continue
        
        return {"success": True, "created_campaigns": len(results), "results": results, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV processing failed: {str(e)}")


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
