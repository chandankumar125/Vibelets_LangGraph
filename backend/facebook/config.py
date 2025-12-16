"""
Configuration module for FBCampaign backend
Manages environment variables and application settings
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration - Universal multi-tenant setup"""
    
    # OpenAI Configuration (Only required environment variable)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    
    # Server Configuration
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    
    # Optional: Default Facebook App ID for frontend OAuth (can be overridden by user)
    DEFAULT_FACEBOOK_APP_ID = os.getenv("DEFAULT_FACEBOOK_APP_ID", "")
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        # Only OpenAI API key is required for AI agent functionality
        # Users provide their own Facebook tokens
        if not cls.OPENAI_API_KEY:
            print("⚠️  Warning: OPENAI_API_KEY is not set")
            print("AI-powered campaign generation will not work without it")
            print("Please set OPENAI_API_KEY in your .env file")
            return False
        
        return True

# Validate configuration on import
Config.validate()
