"""
Facebook Authentication Module
Handles OAuth token validation and Facebook Graph API authentication
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/auth", tags=["Authentication"])

FB_API_URL = "https://graph.facebook.com/v24.0"


class FacebookAuthRequest(BaseModel):
    access_token: str


class TokenValidationResponse(BaseModel):
    is_valid: bool
    app_id: str
    user_id: str
    scopes: list[str]
    expires_at: int


@router.post("/facebook", response_model=dict)
async def facebook_auth(auth_request: FacebookAuthRequest):
    """
    Validate Facebook access token and return user information
    """
    try:
        # Validate token with Facebook's debug endpoint
        async with httpx.AsyncClient() as client:
            # Get token info
            response = await client.get(
                f"{FB_API_URL}/debug_token",
                params={
                    "input_token": auth_request.access_token,
                    "access_token": auth_request.access_token
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid access token")
            
            data = response.json()
            
            if not data.get("data", {}).get("is_valid"):
                raise HTTPException(status_code=401, detail="Token is not valid")
            
            token_data = data["data"]
            
            # Get user information
            user_response = await client.get(
                f"{FB_API_URL}/me",
                params={
                    "access_token": auth_request.access_token,
                    "fields": "id,name,email"
                }
            )
            
            user_data = user_response.json()
            
            return {
                "success": True,
                "user": {
                    "id": user_data.get("id"),
                    "name": user_data.get("name"),
                    "email": user_data.get("email")
                },
                "token_info": {
                    "app_id": token_data.get("app_id"),
                    "scopes": token_data.get("scopes", []),
                    "expires_at": token_data.get("expires_at", 0)
                }
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Facebook API error: {str(e)}")


async def verify_token_permissions(access_token: str, required_scopes: list[str]) -> bool:
    """
    Helper function to verify token has required permissions
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{FB_API_URL}/debug_token",
                params={
                    "input_token": access_token,
                    "access_token": access_token
                }
            )
            
            if response.status_code != 200:
                return False
            
            data = response.json()
            token_scopes = data.get("data", {}).get("scopes", [])
            
            return all(scope in token_scopes for scope in required_scopes)
            
    except Exception:
        return False
