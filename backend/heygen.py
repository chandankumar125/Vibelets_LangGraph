import requests
import os
import mimetypes
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class HeyGenAvatarIntegrator:
    def __init__(self):
        self.heygen_api_key = os.getenv("HEYGEN_API_KEY")
        self.base_url = "https://api.heygen.com"
        self.upload_url = "https://upload.heygen.com/v1/asset"
        self.headers = {
            "X-Api-Key": self.heygen_api_key,
            "Content-Type": "application/json"
        }

    def get_avatars(self):
        """Fetch available avatars from HeyGen API."""
        url = f"{self.base_url}/v2/avatars"
        try:
            # Copy headers and remove Content-Type for GET request
            headers = self.headers.copy()
            if "Content-Type" in headers:
                del headers["Content-Type"]
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            avatars = data.get("data", {}).get("avatars", [])
            return avatars
        except requests.exceptions.RequestException as e:
            print(f"Error fetching avatars: {e}")
            return []

    def upload_asset(self, file_path):
        """Upload a local file to HeyGen and return the asset ID."""
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        file_name = os.path.basename(file_path)
        
        # Update headers for raw upload
        headers = self.headers.copy()
        headers["Content-Type"] = mime_type
        
        try:
            with open(file_path, "rb") as f:
                # Send raw file content as body
                response = requests.post(self.upload_url, headers=headers, data=f)
                response.raise_for_status()
                data = response.json()
                asset_id = data.get("data", {}).get("id")
                return asset_id
        except requests.exceptions.RequestException as e:
            print(f"Error uploading asset {file_name}: {e}")
            return None

    def create_avatar_video(self, audio_asset_id, avatar_id, background_url=None, video_aspect_ratio='9:16'):

        """Create a video using the specified avatar and audio asset."""
        url = f"{self.base_url}/v2/video/generate"
        
        # Base video input
        video_input = {
            "character": {
                "type": "avatar",
                "avatar_id": avatar_id,
                "avatar_style": "normal"
            },
            "voice": {
                "type": "audio",
                "audio_asset_id": audio_asset_id
            }
        }
        
        # Determine dimensions based on aspect ratio
        # Default to Story/Reel (9:16) as it's most common for avatar ads
        dimensions = {
            "width": 720,
            "height": 1280
        }
        
        if background_url:
            video_input["background"] = {
                "type": "image",
                "url": background_url
            }
        
        # Mapping common aspect ratios to HeyGen supported dimensions
        if video_aspect_ratio == '1:1':
            dimensions = {"width": 1080, "height": 1080}
        elif video_aspect_ratio == '4:5':
            dimensions = {"width": 1080, "height": 1350}
        elif video_aspect_ratio == '1.91:1' or video_aspect_ratio == '16:9':
            dimensions = {"width": 1280, "height": 720}
        elif video_aspect_ratio == '9:16':
            dimensions = {"width": 720, "height": 1280}

        payload = {
            "video_inputs": [video_input],
            "dimension": dimensions
        }
        
        print(f"DEBUG: HeyGen Request Payload: {json.dumps(payload, indent=2)}")
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            if not response.ok:
                print(f"DEBUG: HeyGen Failed Response: {response.text}")
            response.raise_for_status()
            data = response.json()
            video_id = data.get("data", {}).get("video_id")
            return {"video_id": video_id}
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if hasattr(e.response, 'text') and e.response.text:
                error_msg += f" - Response: {e.response.text}"
            print(f"Error creating video: {error_msg}")
            return {"error": error_msg}

    def check_video_status(self, video_id):
        """Check the status of the video generation using HeyGen V2 API."""
        url = f"{self.base_url}/v2/video/{video_id}"
        
        try:
            # Copy headers and remove Content-Type for GET request
            headers = self.headers.copy()
            if "Content-Type" in headers:
                del headers["Content-Type"]
            
            print(f"DEBUG: Checking HeyGen V2 status for video: {video_id}")
            response = requests.get(url, headers=headers)
            
            if not response.ok:
                print(f"DEBUG: HeyGen Status Check Failed: {response.reason} - {response.text}")
            
            response.raise_for_status()
            data = response.json()
            status_data = data.get("data", {})
            
            print(f"DEBUG: Video Status Check Result: {status_data.get('status')}")
            # Map V2 status response to format expected by frontend if needed
            # V2 returns video_url, thumbnail_url, status, etc.
            return status_data
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            if hasattr(e.response, 'text') and e.response.text:
                error_msg += f" - Response: {e.response.text}"
            print(f"Error checking status for video {video_id}: {error_msg}")
            return {"status": "error", "error": error_msg}

    def download_video(self, video_url, filename):
        """Download the video from the provided URL."""
        try:
            response = requests.get(video_url, stream=True)
            response.raise_for_status()
            with open(filename, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Video downloaded successfully: {filename}")
        except requests.exceptions.RequestException as e:
            print(f"Error downloading video: {e}")
