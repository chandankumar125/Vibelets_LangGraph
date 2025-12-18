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

    def create_avatar_video(self, audio_asset_id, avatar_id, background_url=None):

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
        
        # Add background if provided
        if background_url:
            video_input["background"] = {
                "type": "image",
                "url": background_url
            }
        
        payload = {
            "video_inputs": [video_input],
            "dimension": {
                "width": 1280,
                "height": 720
            }
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
        """Check the status of the video generation."""
        url = f"{self.base_url}/v1/video_status.get"
        params = {"video_id": video_id}
        
        try:
            # Copy headers and remove Content-Type for GET request
            headers = self.headers.copy()
            if "Content-Type" in headers:
                del headers["Content-Type"]
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            status_data = data.get("data", {})
            print(f"DEBUG: Video Status Check: {json.dumps(status_data, indent=2)}")
            return status_data
        except requests.exceptions.RequestException as e:
            print(f"Error checking status for video {video_id}: {e}")
            return {"status": "error", "error": str(e)}

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
