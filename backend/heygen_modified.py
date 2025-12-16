import requests
import os
import time
import mimetypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
BASE_URL = "https://api.heygen.com"
UPLOAD_URL = "https://upload.heygen.com/v1/asset"

if not HEYGEN_API_KEY:
    raise ValueError("HEYGEN_API_KEY not found in environment variables.")

HEADERS = {
    "X-Api-Key": HEYGEN_API_KEY
}

def get_avatars():
    """Fetch available avatars from HeyGen API."""
    url = f"{BASE_URL}/v2/avatars"
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        data = response.json()
        avatars = data.get("data", {}).get("avatars", [])
        return avatars
    except requests.exceptions.RequestException as e:
        print(f"Error fetching avatars: {e}")
        return []

def upload_asset(file_path):
    """Upload a local file to HeyGen and return the asset ID."""
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"
    
    file_name = os.path.basename(file_path)
    
    # Update headers for raw upload
    headers = HEADERS.copy()
    headers["Content-Type"] = mime_type
    
    try:
        with open(file_path, "rb") as f:
            # Send raw file content as body
            response = requests.post(UPLOAD_URL, headers=headers, data=f)
            response.raise_for_status()
            data = response.json()
            asset_id = data.get("data", {}).get("id")
            return asset_id
    except requests.exceptions.RequestException as e:
        print(f"Error uploading asset {file_name}: {e}")
        if 'response' in locals() and response.content:
             print(f"Response content: {response.content.decode()}")
        return None

def create_video(avatar_id, audio_asset_id):
    """Create a video using the specified avatar and audio asset."""
    url = f"{BASE_URL}/v2/video/generate"
    
    payload = {
        "video_inputs": [
            {
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
        ],
        "dimension": {
            "width": 1280,
            "height": 720
        }
    }
    
    try:
        response = requests.post(url, headers=HEADERS, json=payload)
        response.raise_for_status()
        data = response.json()
        video_id = data.get("data", {}).get("video_id")
        return video_id
    except requests.exceptions.RequestException as e:
        print(f"Error creating video: {e}")
        if response.content:
            print(f"Response content: {response.content.decode()}")
        return None

def check_status(video_id):
    """Check the status of the video generation."""
    url = f"{BASE_URL}/v1/video_status.get"
    params = {"video_id": video_id}
    
    try:
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("data", {})
    except requests.exceptions.RequestException as e:
        print(f"Error checking status for video {video_id}: {e}")
        return None

def download_video(video_url, filename):
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

def main():
    print("--- HeyGen Avatar Video PoC ---")
    
    # 1. List Avatars
    print("\nFetching avatars...")
    avatars = get_avatars()
    if not avatars:
        print("No avatars found or error occurred.")
        return

    # Display first 5 avatars for selection
    print(f"Found {len(avatars)} avatars. Showing first 5:")
    for i, avatar in enumerate(avatars[:5]):
        print(f"{i+1}. {avatar.get('avatar_name')} (ID: {avatar.get('avatar_id')})")
    
    # Simple selection (default to first one for automation if needed, or ask user)
    # For this PoC, we'll just pick the first one to be safe, or let user input if interactive.
    # But since I'm running it, I'll hardcode index 0 for now or make it interactive if I can.
    # Let's default to the first one to avoid blocking on input in non-interactive environments if any.
    selected_avatar = avatars[0]
    avatar_id = selected_avatar.get("avatar_id")
    print(f"\nSelected Avatar: {selected_avatar.get('avatar_name')} ({avatar_id})")

    # 2. Find Audio Files
    audio_extensions = (".mp3", ".wav", ".m4a")
    audio_files = [f for f in os.listdir(".") if f.lower().endswith(audio_extensions)]
    
    if not audio_files:
        print("\nNo audio files found in the current directory.")
        return
    
    print(f"\nFound {len(audio_files)} audio files: {audio_files}")

    for audio_file in audio_files:
        print(f"\nProcessing: {audio_file}")
        
        # 3. Upload Audio
        print("Uploading audio...")
        asset_id = upload_asset(audio_file)
        if not asset_id:
            print("Failed to upload audio. Skipping.")
            continue
        print(f"Audio uploaded. Asset ID: {asset_id}")
        
        # 4. Create Video
        print("Creating video...")
        video_id = create_video(avatar_id, asset_id)
        if not video_id:
            print("Failed to create video. Skipping.")
            continue
        print(f"Video creation initiated. Video ID: {video_id}")
        
        # 5. Check Status Loop
        print("Waiting for video generation to complete...")
        while True:
            status_data = check_status(video_id)
            if not status_data:
                print("Could not get status. Retrying in 5s...")
                time.sleep(5)
                continue
            
            status = status_data.get("status")
            print(f"Status: {status}")
            
            if status == "completed":
                video_url = status_data.get("video_url")
                print(f"Video generated! URL: {video_url}")
                
                # 6. Download Video
                output_filename = f"heygen_{os.path.splitext(audio_file)[0]}.mp4"
                download_video(video_url, output_filename)
                break
            elif status == "failed":
                error = status_data.get("error")
                print(f"Video generation failed: {error}")
                break
            
            time.sleep(5)

if __name__ == "__main__":
    main()
