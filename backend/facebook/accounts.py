"""
Facebook Accounts Module
Handles ad accounts and pages retrieval
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
from config import Config
from typing import List, Optional

router = APIRouter(tags=["Accounts"])

FB_API_URL = Config.FB_API_URL


class AdAccount(BaseModel):
    id: str
    name: str
    currency: str
    account_status: int = 1


class FacebookPage(BaseModel):
    id: str
    name: str
    access_token: str


@router.get("/ad-accounts")
async def list_ad_accounts(access_token: str = Query(...)):
    """
    Fetch all ad accounts for the authenticated user
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FB_API_URL}/me/adaccounts",
                params={
                    "access_token": access_token,
                    "fields": "id,name,currency,account_status"
                }
            )
            
            if response.status_code != 200:
                print(f"❌ Facebook API Error: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Facebook API error: {response.text}"
                )
            
            data = response.json()
            print(f"🔍 RAW FACEBOOK RESPONSE: {data}")  # Debug print
            accounts = data.get("data", [])
            print(f"✅ Found {len(accounts)} accounts")
            
            # Transform to match frontend expectations
            # Remove 'act_' prefix from IDs for display, but keep original for API calls
            ad_accounts = [
                {
                    "id": account["id"].replace("act_", ""),
                    "name": account.get("name", "Unnamed Account"),
                    "currency": account.get("currency", "USD"),
                    "account_status": account.get("account_status", 1)
                }
                for account in accounts
            ]
            
            return {"data": ad_accounts}
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")


@router.get("/pages")
async def list_pages(access_token: str = Query(...)):
    """
    Fetch all Facebook pages for the authenticated user
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FB_API_URL}/me/accounts",
                params={
                    "access_token": access_token,
                    "fields": "id,name,access_token"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Facebook API error: {response.text}"
                )
            
            data = response.json()
            pages = data.get("data", [])
            
            return {"data": pages}
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request error: {str(e)}")
