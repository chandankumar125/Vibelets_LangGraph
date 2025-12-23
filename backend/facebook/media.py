"""
Facebook Media Module
Handles image and video uploads to Facebook Ad Accounts
"""
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
import httpx
from config import Config
from typing import List, Optional
from PIL import Image
import io
import aiofiles
import os
import tempfile

router = APIRouter(prefix="/media", tags=["Media"])

FB_API_URL = Config.FB_API_URL

# File size limits (in bytes)
MAX_IMAGE_SIZE = 30 * 1024 * 1024  # 30MB
MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024  # 4GB

# Allowed formats
ALLOWED_IMAGE_FORMATS = {"jpg", "jpeg", "png"}
ALLOWED_VIDEO_FORMATS = {"mp4", "mov", "avi"}


class MediaItem(BaseModel):
    id: str
    url: str
    type: str  # 'image' or 'video'
    name: str


@router.post("/upload")
async def upload_media(
    access_token: str = Form(...),
    ad_account_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Upload an image or video to Facebook Ad Account
    """
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        file_extension = file.filename.split(".")[-1].lower() if file.filename else ""
        
        # Determine if it's an image or video
        is_image = file_extension in ALLOWED_IMAGE_FORMATS
        is_video = file_extension in ALLOWED_VIDEO_FORMATS
        
        if not is_image and not is_video:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_extension}. Allowed: {ALLOWED_IMAGE_FORMATS | ALLOWED_VIDEO_FORMATS}"
            )
        
        # Validate file size
        if is_image and file_size > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image size exceeds maximum of {MAX_IMAGE_SIZE / (1024*1024)}MB"
            )
        
        if is_video and file_size > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Video size exceeds maximum of {MAX_VIDEO_SIZE / (1024*1024*1024)}GB"
            )
        
        # Validate image dimensions if it's an image
        if is_image:
            try:
                img = Image.open(io.BytesIO(file_content))
                width, height = img.size
                
                # Facebook recommends at least 1080x1080 for images
                if width < 600 or height < 600:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Image dimensions too small. Minimum: 600x600px. Got: {width}x{height}px"
                    )
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
        # Upload to Facebook
        async with httpx.AsyncClient(timeout=300.0) as client:
            if is_image:
                # Upload image
                response = await client.post(
                    f"{FB_API_URL}/act_{ad_account_id}/adimages",
                    params={"access_token": access_token},
                    files={
                        "filename": (file.filename, file_content, file.content_type)
                    }
                )
            else:
                # Upload video
                response = await client.post(
                    f"{FB_API_URL}/act_{ad_account_id}/advideos",
                    params={"access_token": access_token},
                    files={
                        "source": (file.filename, file_content, file.content_type)
                    },
                    data={
                        "title": file.filename
                    }
                )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Facebook upload failed: {response.text}"
                )
            
            result = response.json()
            
            # Extract specific ID for easier frontend consumption
            media_id = None
            if is_image:
                images_dict = result.get("images", {})
                if images_dict:
                    # Get the hash of the first (and usually only) image in the response
                    first_img = list(images_dict.values())[0]
                    media_id = first_img.get("hash")
            else:
                media_id = result.get("id")
            
            return {
                "success": True,
                "media_type": "image" if is_image else "video",
                "id": media_id,
                "data": result
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
