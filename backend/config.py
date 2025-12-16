import os

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY")
    FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
    
    # API Endpoints
    ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech"
    HEYGEN_API_BASE_URL = "https://api.heygen.com"
    HEYGEN_UPLOAD_URL = "https://upload.heygen.com/v1/asset"
    HEYGEN_CREATE_VIDEO_URL = "https://api.heygen.com/v2/video/generate"
    HEYGEN_STATUS_URL = "https://api.heygen.com/v1/video_status.get"
