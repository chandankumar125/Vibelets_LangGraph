"""
Facebook Authentication utilities
Handles OAuth flow, token validation, and user session management
"""
import httpx
from typing import Dict, Any, Optional, List

FB_API_URL = "https://graph.facebook.com/v22.0"


async def validate_access_token(access_token: str) -> Dict[str, Any]:
    """
    Validate Facebook access token and return token info
    
    Args:
        access_token: Facebook access token
        
    Returns:
        Dict with token info including user_id, app_id, is_valid, etc.
    """
    url = f"{FB_API_URL}/debug_token"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params={
                "input_token": access_token,
                "access_token": access_token
            },
            timeout=30
        )
    
    data = response.json()
    
    if "error" in data:
        return {
            "is_valid": False,
            "error": data["error"].get("message", "Invalid token")
        }
    
    token_data = data.get("data", {})
    return {
        "is_valid": token_data.get("is_valid", False),
        "user_id": token_data.get("user_id"),
        "app_id": token_data.get("app_id"),
        "expires_at": token_data.get("expires_at"),
        "scopes": token_data.get("scopes", [])
    }


async def get_user_info(access_token: str) -> Dict[str, Any]:
    """
    Get Facebook user profile information
    
    Args:
        access_token: Facebook access token
        
    Returns:
        Dict with user info (id, name, email, etc.)
    """
    url = f"{FB_API_URL}/me"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params={
                "access_token": access_token,
                "fields": "id,name,email"
            },
            timeout=30
        )
    
    data = response.json()
    
    if "error" in data:
        return {
            "error": data["error"].get("message", "Failed to get user info")
        }
    
    return data


async def get_user_ad_accounts(access_token: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch user's ad accounts
    
    Args:
        access_token: Facebook access token
        user_id: Optional user ID (will fetch from token if not provided)
        
    Returns:
        List of ad accounts with id, name, account_status, etc.
    """
    if not user_id:
        user_info = await get_user_info(access_token)
        if "error" in user_info:
            return []
        user_id = user_info.get("id")
    
    url = f"{FB_API_URL}/{user_id}/adaccounts"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params={
                "access_token": access_token,
                "fields": "id,name,account_status,currency,timezone_name,business"
            },
            timeout=30
        )
    
    data = response.json()
    
    if "error" in data:
        return []
    
    return data.get("data", [])


async def authenticate_user(access_token: str) -> Dict[str, Any]:
    """
    Complete authentication flow: validate token, get user info, and fetch ad accounts
    
    Args:
        access_token: Facebook access token
        
    Returns:
        Dict with user_id, user_info, ad_accounts, and validation status
    """
    # Validate token
    token_info = await validate_access_token(access_token)
    
    if not token_info.get("is_valid"):
        return {
            "success": False,
            "error": token_info.get("error", "Invalid access token")
        }
    
    # Get user info
    user_info = await get_user_info(access_token)
    
    if "error" in user_info:
        return {
            "success": False,
            "error": user_info["error"]
        }
    
    user_id = user_info.get("id")
    
    # Get ad accounts
    ad_accounts = await get_user_ad_accounts(access_token, user_id)
    
    return {
        "success": True,
        "user_id": user_id,
        "user_info": user_info,
        "ad_accounts": ad_accounts,
        "token_info": token_info
    }
