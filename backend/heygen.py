from dotenv import load_dotenv
import os
import requests
from typing import List, Dict, Optional
import mimetypes
from config import Config

load_dotenv()

class HeyGenAvatarIntegrator:
    """Integrates voiceover with HeyGen avatar"""
    
    def __init__(self):
        self.api_key = "sk_V2_hgu_kFKikEzcc9J_vkOeLpbL9s30JB2N4cUc4LC1tiR5cXIh"

    
    def get_avatars(self) -> List[Dict]:
        """Fetch available avatars from HeyGen API"""
        url = f"{Config.HEYGEN_API_BASE_URL}/v2/avatars"
        headers = {
            "X-Api-Key": self.api_key
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", {}).get("avatars", [])
        except Exception as e:
            print(f"✗ Error fetching avatars: {str(e)}")
            return []

    def upload_asset(self, file_path: str) -> Optional[str]:
        """Upload a local file to HeyGen and return the asset ID"""
        url = f"{Config.HEYGEN_UPLOAD_URL}"
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
            
        headers = {
            "X-Api-Key": self.api_key,
            "Content-Type": mime_type
        }
        
        try:
            with open(file_path, "rb") as f:
                response = requests.post(url, headers=headers, data=f)
                response.raise_for_status()
                data = response.json()
                asset_id = data.get("data", {}).get("id")
                print(f"✓ Audio uploaded to HeyGen. Asset ID: {asset_id}")
                return asset_id
        except Exception as e:
            print(f"✗ Error uploading asset: {str(e)}")
            return None

    def create_avatar_video(self, audio_input: str, avatar_id: str = "default", is_asset_id: bool = False) -> Dict:
        """Create video with HeyGen avatar and audio (url or asset_id)"""
        
        headers = {
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        voice_config = {
            "type": "audio",
        }
        
        if is_asset_id:
            voice_config["audio_asset_id"] = audio_input
        else:
            voice_config["audio_url"] = audio_input

        data = {
            "video_inputs": [{
                "character": {
                    "type": "avatar",
                    "avatar_id": avatar_id,
                    "avatar_style": "normal"
                },
                "voice": voice_config,
                "background": {
                    "type": "color",
                    "value": "#FFFFFF"
                }
            }],
            "dimension": {
                "width": 1280,
                "height": 720
            },
            "aspect_ratio": "16:9"
        }
        
        try:
            response = requests.post(
                Config.HEYGEN_CREATE_VIDEO_URL,
                json=data,
                headers=headers
            )
            response.raise_for_status()
            result = response.json()
            
            print(f"✓ Avatar video creation initiated")
            video_id = result.get("data", {}).get("video_id")
            print(f"  Video ID: {video_id}")
            
            return {"video_id": video_id, "raw": result}
            
        except Exception as e:
            print(f"✗ Error creating avatar video: {str(e)}")
            if 'response' in locals() and response.content:
                 print(f"Response content: {response.content.decode()}")
            return {"error": str(e)}
    
    def check_video_status(self, video_id: str) -> Dict:
        """Check the status of video generation"""
        
        headers = {
            "X-Api-Key": self.api_key
        }
        
        params = {
            "video_id": video_id
        }
        
        try:
            response = requests.get(
                Config.HEYGEN_STATUS_URL,
                params=params,
                headers=headers
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": str(e)}