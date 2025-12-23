"""
Facebook Campaign AI Agents
Specialized agents for campaign creation, preview, and modification
"""
from typing import Dict, Any, List, Optional
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from config import Config
class CampaignCreationAgent:
    """AI agent that creates Facebook ad campaigns based on selected media"""
    
    def __init__(self):
        """Initialize the campaign creation agent"""
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert Facebook Ads campaign strategist. Your task is to create 
            a comprehensive ad campaign configuration based on the provided media (image or video).
            
            You must analyze the media and create a campaign that includes:
            1. Campaign name and objective (choose from: OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES, VIDEO_VIEWS, BRAND_AWARENESS)
            2. Ad set configuration with targeting, budget, and schedule
            3. Ad creative including headline, primary text, description, and call-to-action
            
            Return your response as a structured JSON object with the following format:
            {{
                "campaign": {{
                    "name": "Campaign name",
                    "objective": "OUTCOME_TRAFFIC",
                    "special_ad_categories": ["NONE"]
                }},
                "adset": {{
                    "name": "Ad Set name",
                    "daily_budget": 1000,
                    "targeting": {{
                        "geo_locations": {{"countries": ["US"]}},
                        "age_min": 18,
                        "age_max": 65,
                        "genders": [1, 2]
                    }},
                    "optimization_goal": "LINK_CLICKS",
                    "billing_event": "IMPRESSIONS"
                }},
                "ad": {{
                    "name": "Ad name",
                    "headline": "Compelling headline (max 40 chars)",
                    "primary_text": "Engaging primary text (max 125 chars)",
                    "description": "Clear description (max 30 chars)",
                    "call_to_action": "LEARN_MORE",
                    "link": "https://example.com"
                }}
            }}
            
            Make the campaign compelling, professional, and optimized for the media type."""),
            ("human", """Create a Facebook ad campaign for the following media:

Media Type: {media_type}
Media Filename: {media_filename}
Media URL: {media_url}

Additional Context:
{context}

Generate a complete campaign configuration.""")
        ])
    
    async def create_campaign(
        self, 
        media: Dict[str, Any],
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a campaign configuration based on selected media
        
        Args:
            media: Media metadata dict
            context: Optional additional context (product info, analysis, etc.)
            
        Returns:
            Campaign configuration dict
        """
        media_type = media.get("type", "image")
        media_filename = media.get("filename", "")
        media_url = media.get("url", "")
        
        if not context:
            context = "No additional context provided. Use your best judgment based on the media."
        
        chain = self.prompt | self.llm
        
        response = await chain.ainvoke({
            "media_type": media_type,
            "media_filename": media_filename,
            "media_url": media_url,
            "context": context
        })
        
        # Parse the response
        import json
        try:
            # Extract JSON from response
            content = response.content
            # Find JSON in the response
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                campaign_config = json.loads(json_str)
                return campaign_config
            else:
                # Fallback: return a default structure
                return self._get_default_config(media_type)
        except Exception as e:
            print(f"Error parsing campaign config: {e}")
            return self._get_default_config(media_type)
    
    def _get_default_config(self, media_type: str) -> Dict[str, Any]:
        """Generate a default campaign configuration"""
        objective = "VIDEO_VIEWS" if media_type == "video" else "OUTCOME_TRAFFIC"
        
        return {
            "campaign": {
                "name": f"AI Generated {media_type.title()} Campaign",
                "objective": objective,
                "special_ad_categories": ["NONE"]
            },
            "adset": {
                "name": f"{media_type.title()} Ad Set",
                "daily_budget": 2000,  # $20.00 in cents
                "targeting": {
                    "geo_locations": {"countries": ["US"]},
                    "age_min": 18,
                    "age_max": 65,
                    "genders": [1, 2]
                },
                "optimization_goal": "LINK_CLICKS",
                "billing_event": "IMPRESSIONS"
            },
            "ad": {
                "name": f"{media_type.title()} Ad",
                "headline": "Discover Something Amazing",
                "primary_text": "Check out this incredible offer! Limited time only.",
                "description": "Learn more today",
                "call_to_action": "LEARN_MORE",
                "link": "https://example.com"
            }
        }


class CampaignPreviewAgent:
    """AI agent that generates human-readable campaign previews"""
    
    def __init__(self):
        """Initialize the campaign preview agent"""
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a Facebook Ads campaign reviewer. Your task is to create a 
            clear, human-readable preview of a campaign configuration.
            
            Create a preview that includes:
            1. Campaign overview (name, objective, budget)
            2. Targeting details (audience, location, demographics)
            3. Ad creative preview (headline, text, CTA)
            4. Estimated performance metrics
            
            Make it easy to understand for non-technical users."""),
            ("human", """Generate a preview for this campaign configuration:

{campaign_config}

Media: {media_type} - {media_filename}

Create a clear, professional preview.""")
        ])
    
    async def generate_preview(
        self,
        campaign_config: Dict[str, Any],
        media: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a preview of the campaign
        
        Args:
            campaign_config: Campaign configuration dict
            media: Media metadata dict
            
        Returns:
            Preview data dict
        """
        import json
        
        chain = self.prompt | self.llm
        
        response = await chain.ainvoke({
            "campaign_config": json.dumps(campaign_config, indent=2),
            "media_type": media.get("type", "image"),
            "media_filename": media.get("filename", "")
        })
        
        return {
            "preview_text": response.content,
            "campaign_config": campaign_config,
            "media": media
        }


class CampaignModificationAgent:
    """AI agent that handles campaign modifications based on user feedback"""
    
    def __init__(self):
        """Initialize the campaign modification agent"""
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a Facebook Ads campaign editor. Your task is to modify 
            campaign configurations based on user feedback.
            
            Analyze the user's modification request and update the campaign configuration accordingly.
            Ensure all changes comply with Facebook Ads API requirements.
            
            Return the COMPLETE updated campaign configuration as JSON, not just the changes."""),
            ("human", """Current campaign configuration:
{current_config}

User modification request:
{modification_request}

Update the campaign configuration based on the user's request. Return the complete updated JSON.""")
        ])
    
    async def modify_campaign(
        self,
        current_config: Dict[str, Any],
        modification_request: str
    ) -> Dict[str, Any]:
        """
        Modify campaign based on user feedback
        
        Args:
            current_config: Current campaign configuration
            modification_request: User's modification request
            
        Returns:
            Updated campaign configuration
        """
        import json
        
        chain = self.prompt | self.llm
        
        response = await chain.ainvoke({
            "current_config": json.dumps(current_config, indent=2),
            "modification_request": modification_request
        })
        
        # Parse the response
        try:
            content = response.content
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_str = content[start_idx:end_idx]
                updated_config = json.loads(json_str)
                return updated_config
            else:
                # If parsing fails, return current config
                return current_config
        except Exception as e:
            print(f"Error parsing modified config: {e}")
            return current_config


# Stub functions for Facebook API integration
# TODO: Replace with actual Facebook Graph API calls

import httpx
from fastapi import HTTPException

FB_API_URL = "https://graph.facebook.com/v22.0"
VALID_OBJECTIVES = [
    "APP_INSTALLS", "BRAND_AWARENESS", "EVENT_RESPONSES", "LEAD_GENERATION",
    "LINK_CLICKS", "LOCAL_AWARENESS", "MESSAGES", "OFFER_CLAIMS", "PAGE_LIKES",
    "POST_ENGAGEMENT", "PRODUCT_CATALOG_SALES", "REACH", "STORE_VISITS",
    "VIDEO_VIEWS", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS",
    "OUTCOME_SALES", "OUTCOME_TRAFFIC", "OUTCOME_APP_PROMOTION", "CONVERSIONS"
]

async def get_user_pages(access_token: str) -> List[Dict[str, Any]]:
    """Fetch user's Facebook Pages"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{FB_API_URL}/me/accounts",
                params={
                    "fields": "id,name,access_token,category,picture",
                    "access_token": access_token
                },
                timeout=30
            )
            data = resp.json()
            if "error" in data:
                print(f"Error fetching pages: {data['error'].get('message')}")
                return []
            return data.get("data", [])
    except Exception as e:
        print(f"Exception fetching pages: {e}")
        return []

async def authenticate_user(access_token: str) -> Dict[str, Any]:
    """
    Authenticate user, get ad accounts and pages
    """
    try:
        # 1. Get User Info
        async with httpx.AsyncClient() as client:
            user_resp = await client.get(
                f"{FB_API_URL}/me",
                params={"fields": "id,name", "access_token": access_token}
            )
            
            if user_resp.status_code != 200:
                error_data = user_resp.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to authenticate with Facebook")
                }
            
            user_data = user_resp.json()
            user_id = user_data.get("id")
            
            # 2. Get Ad Accounts
            accounts_resp = await client.get(
                f"{FB_API_URL}/me/adaccounts",
                params={
                    "fields": "id,name,account_status,currency,timezone_name",
                    "access_token": access_token
                }
            )
            
            ad_accounts = []
            if accounts_resp.status_code == 200:
                accounts_data = accounts_resp.json()
                ad_accounts = accounts_data.get("data", [])
                
                for acc in ad_accounts:
                    status_map = {1: "ACTIVE", 2: "DISABLED"}
                    acc["status_code"] = acc.get("account_status")
                    acc["account_status"] = status_map.get(acc.get("account_status"), "INACTIVE")
            
            # 3. Get Pages
            pages = await get_user_pages(access_token)

            return {
                "success": True,
                "user_id": user_id,
                "user_name": user_data.get("name"),
                "ad_accounts": ad_accounts,
                "pages": pages
            }
            
    except Exception as e:
        print(f"Facebook Auth Exception: {e}")
        return {
            "success": False,
            "error": str(e)
        }

async def create_campaign(account_id: str, name: str, objective: str, access_token: str, special_ad_categories=None):
    if special_ad_categories is None:
        special_ad_categories = ["NONE"]

    if objective not in VALID_OBJECTIVES:
        # Try to find a similar one or default
        objective = "OUTCOME_TRAFFIC"

    url = f"{FB_API_URL}/act_{account_id}/campaigns"
    payload = {
        "name": name,
        "objective": objective,
        "status": "PAUSED",
        "special_ad_categories": special_ad_categories
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
            timeout=30
        )
        data = response.json()
        if "error" in data:
            raise Exception(f"Facebook API error (Campaign): {data['error'].get('message')}")
        return data

async def create_adset(account_id, campaign_id, name, daily_budget_cents, access_token, targeting=None):
    url = f"{FB_API_URL}/act_{account_id}/adsets"

    if targeting is None:
        targeting = {
            "geo_locations": {"countries": ["US"]},
            "age_min": 18,
            "age_max": 65,
            "genders": [1, 2]
        }

    # Format daily_budget correctly (Facebook expects integer cents)
    try:
        daily_budget = int(daily_budget_cents)
    except:
        daily_budget = 2000 # Default $20

    import datetime
    start_time = datetime.datetime.now() + datetime.timedelta(hours=1)
    end_time = start_time + datetime.timedelta(days=7)

    payload = {
        "name": name,
        "campaign_id": campaign_id,
        "daily_budget": daily_budget,
        "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "end_time": end_time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "REACH",
        "status": "PAUSED",
        "targeting": targeting
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
            timeout=30
        )
        data = response.json()
        if "error" in data:
            # Fallback for bid_amount or other constraints
            print(f"Adset creation error, retrying with simple payload: {data['error'].get('message')}")
            # Try again with minimal fields
            minimal_payload = {
                "name": name,
                "campaign_id": campaign_id,
                "daily_budget": daily_budget,
                "billing_event": "IMPRESSIONS",
                "optimization_goal": "REACH",
                "status": "PAUSED",
                "targeting": targeting
            }
            response = await client.post(
                url,
                params={"access_token": access_token},
                json=minimal_payload,
                timeout=30
            )
            data = response.json()
            if "error" in data:
                raise Exception(f"Facebook API error (AdSet): {data['error'].get('message')}")
        return data

async def create_video_ad(account_id, adset_id, page_id, ad_name, video_id, thumbnail_hash, message, link, access_token):
    url = f"{FB_API_URL}/act_{account_id}/ads"

    payload = {
        "name": ad_name,
        "adset_id": adset_id,
        "creative": {
            "object_story_spec": {
                "page_id": page_id,
                "video_data": {
                    "video_id": video_id,
                    "title": ad_name,
                    "message": message,
                    "call_to_action": {
                        "type": "LEARN_MORE",
                        "value": {
                            "link": link
                        }
                    }
                }
            }
        },
        "status": "PAUSED"
    }
    
    if thumbnail_hash:
        payload["creative"]["object_story_spec"]["video_data"]["image_hash"] = thumbnail_hash

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
            timeout=30
        )
        data = response.json()
        if "error" in data:
            raise Exception(f"Facebook API error (Video Ad): {data['error'].get('message')}")
        return data

async def create_image_ad(account_id, adset_id, page_id, ad_name, image_hash, message, link, access_token):
    url = f"{FB_API_URL}/act_{account_id}/ads"

    payload = {
        "name": ad_name,
        "adset_id": adset_id,
        "creative": {
            "object_story_spec": {
                "page_id": page_id,
                "link_data": {
                    "image_hash": image_hash,
                    "message": message,
                    "link": link,
                    "call_to_action": {
                        "type": "LEARN_MORE",
                        "value": {
                            "link": link
                        }
                    }
                }
            }
        },
        "status": "PAUSED"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"access_token": access_token},
            json=payload,
            timeout=30
        )
        data = response.json()
        if "error" in data:
            raise Exception(f"Facebook API error (Image Ad): {data['error'].get('message')}")
        return data

