"""
FBCampaign Backend Server
FastAPI application for Facebook ad campaign management with AI agent
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import Config

# Import routers
from facebook.auth import router as auth_router
from facebook.accounts import router as accounts_router
from facebook.media import router as media_router
from facebook.campaign import router as campaign_router
from facebook.management import router as management_router
from agent.router import router as agent_router

app = FastAPI(
    title="FBCampaign API",
    description="AI-powered Facebook campaign creation and management",
    version="1.0.0"
)

# Configure CORS to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(media_router)
app.include_router(campaign_router)
app.include_router(management_router)
app.include_router(agent_router)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "FBCampaign API"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "modules": [
            "authentication",
            "accounts",
            "media",
            "campaign",
            "ai_agent"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
