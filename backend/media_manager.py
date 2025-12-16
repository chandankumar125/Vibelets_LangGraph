"""
Media Manager for HeyGen-generated content
Handles listing, metadata extraction, and selection of images and videos
"""
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import mimetypes


class MediaManager:
    """Manages HeyGen-generated media files (images and videos)"""
    
    def __init__(self, static_dir: str = "static"):
        """
        Initialize MediaManager
        
        Args:
            static_dir: Base directory for static files
        """
        self.static_dir = static_dir
        self.image_dir = os.path.join(static_dir, "images")
        self.video_dir = os.path.join(static_dir, "videos")
        self.audio_dir = os.path.join(static_dir, "audio")
        
        # Create directories if they don't exist
        os.makedirs(self.image_dir, exist_ok=True)
        os.makedirs(self.video_dir, exist_ok=True)
        os.makedirs(self.audio_dir, exist_ok=True)
    
    def list_images(self) -> List[Dict[str, Any]]:
        """
        List all available images
        
        Returns:
            List of image metadata dicts
        """
        images = []
        
        if not os.path.exists(self.image_dir):
            return images
        
        for filename in os.listdir(self.image_dir):
            file_path = os.path.join(self.image_dir, filename)
            
            # Check if it's a file and has image extension
            if os.path.isfile(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                
                if mime_type and mime_type.startswith("image/"):
                    images.append(self._get_file_metadata(file_path, "image"))
        
        # Sort by modification time (newest first)
        images.sort(key=lambda x: x["modified_at"], reverse=True)
        
        return images
    
    def list_videos(self) -> List[Dict[str, Any]]:
        """
        List all available videos
        
        Returns:
            List of video metadata dicts
        """
        videos = []
        
        if not os.path.exists(self.video_dir):
            return videos
        
        for filename in os.listdir(self.video_dir):
            file_path = os.path.join(self.video_dir, filename)
            
            # Check if it's a file and has video extension
            if os.path.isfile(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                
                if mime_type and mime_type.startswith("video/"):
                    videos.append(self._get_file_metadata(file_path, "video"))
        
        # Sort by modification time (newest first)
        videos.sort(key=lambda x: x["modified_at"], reverse=True)
        
        return videos
    
    def list_all_media(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        List all available media (images and videos)
        
        Returns:
            Dict with 'images' and 'videos' lists
        """
        return {
            "images": self.list_images(),
            "videos": self.list_videos()
        }
    
    def get_media_by_id(self, media_id: str) -> Optional[Dict[str, Any]]:
        """
        Get media metadata by ID (filename)
        
        Args:
            media_id: Media identifier (filename)
            
        Returns:
            Media metadata dict or None if not found
        """
        all_media = self.list_all_media()
        
        # Search in images
        for image in all_media["images"]:
            if image["id"] == media_id:
                return image
        
        # Search in videos
        for video in all_media["videos"]:
            if video["id"] == media_id:
                return video
        
        return None
    
    def _get_file_metadata(self, file_path: str, media_type: str) -> Dict[str, Any]:
        """
        Extract metadata from a file
        
        Args:
            file_path: Path to the file
            media_type: Type of media ('image' or 'video')
            
        Returns:
            Metadata dict
        """
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        modified_at = os.path.getmtime(file_path)
        
        # Get relative URL path
        if media_type == "image":
            url_path = f"/static/images/{filename}"
        elif media_type == "video":
            url_path = f"/static/videos/{filename}"
        else:
            url_path = f"/static/{filename}"
        
        mime_type, _ = mimetypes.guess_type(file_path)
        
        return {
            "id": filename,
            "filename": filename,
            "type": media_type,
            "mime_type": mime_type,
            "file_path": file_path,
            "url": url_path,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "modified_at": modified_at
        }
    
    def get_latest_heygen_video(self) -> Optional[Dict[str, Any]]:
        """
        Get the most recently generated HeyGen video
        
        Returns:
            Video metadata or None if no videos found
        """
        videos = self.list_videos()
        
        # Filter for HeyGen videos (those starting with 'heygen_')
        heygen_videos = [v for v in videos if v["filename"].startswith("heygen_")]
        
        if heygen_videos:
            return heygen_videos[0]  # Already sorted by newest first
        
        return None
    
    def get_latest_generated_images(self, count: int = 2) -> List[Dict[str, Any]]:
        """
        Get the most recently generated images
        
        Args:
            count: Number of images to return
            
        Returns:
            List of image metadata
        """
        images = self.list_images()
        return images[:count]

    async def upload_image_to_facebook(self, file_path: str, access_token: str, account_id: str) -> Dict[str, Any]:
        """
        Upload an image to Facebook Ad Account
        
        Args:
            file_path: Path to local image file
            access_token: Facebook access token
            account_id: Ad account ID
            
        Returns:
            Dict with 'hash' of the uploaded image
        """
        import httpx
        
        url = f"https://graph.facebook.com/v22.0/act_{account_id}/adimages"
        
        try:
            async with httpx.AsyncClient() as client:
                # Read file content
                with open(file_path, "rb") as f:
                    file_content = f.read()
                    
                filename = os.path.basename(file_path)
                files = {"filename": (filename, file_content, "image/jpeg")} # Assume jpeg/png
                
                response = await client.post(
                    url,
                    params={"access_token": access_token},
                    files=files,
                    timeout=60
                )
                
                data = response.json()
                
                if "error" in data:
                    return {"error": data["error"].get("message")}
                
                # Success - returns list of images with hash
                if "images" in data and filename in data["images"]:
                    return {"hash": data["images"][filename]["hash"]}
                
                return {"error": "Upload successful but hash not found"}
                
        except Exception as e:
            return {"error": str(e)}

    async def upload_video_to_facebook(self, file_path: str, access_token: str, account_id: str) -> Dict[str, Any]:
        """
        Upload a video to Facebook Ad Account
        
        Args:
            file_path: Path to local video file
            access_token: Facebook access token
            account_id: Ad account ID
            
        Returns:
            Dict with 'video_id'
        """
        import httpx
        
        url = f"https://graph.facebook.com/v22.0/act_{account_id}/advideos"
        
        try:
            async with httpx.AsyncClient() as client:
                # Read file content
                with open(file_path, "rb") as f:
                    file_content = f.read()
                    
                filename = os.path.basename(file_path)
                files = {"source": (filename, file_content, "video/mp4")} 
                
                response = await client.post(
                    url,
                    params={"access_token": access_token},
                    files=files,
                    timeout=120 # Videos take longer
                )
                
                data = response.json()
                
                if "error" in data:
                    return {"error": data["error"].get("message")}
                
                if "id" in data:
                    return {"video_id": data["id"]}
                
                return {"error": "Upload successful but video ID not found"}
                
        except Exception as e:
            return {"error": str(e)}
