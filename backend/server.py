from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
from dotenv import load_dotenv

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import existing classes
from scraper import ProductScraper
from productAnalyzer import ProductAnalyzer
from audioGeneration import ElevenLabsVoiceGenerator
from heygen import HeyGenAvatarIntegrator
from image_generation import ImageGenerator

load_dotenv()

app = FastAPI(title="Ad Campaign Generator API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation Error: {exc}")
    try:
        body = await request.json()
        print(f"Request Body: {body}")
    except:
        print("Could not read body")
        
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# Initialize tools
scraper = ProductScraper()
analyzer = ProductAnalyzer()
voice_gen = ElevenLabsVoiceGenerator()
heygen = HeyGenAvatarIntegrator()
image_gen = ImageGenerator()

# --- Pydantic Models ---

class ScrapeRequest(BaseModel):
    url: str

class AnalyzeRequest(BaseModel):
    product_data: Dict[str, Any]
    feedback: Optional[str] = None
    current_analysis: Optional[Dict[str, Any]] = None

class ScriptRequest(BaseModel):
    product_data: Dict[str, Any]
    analysis: Dict[str, Any]
    feedback: Optional[str] = None
    current_scripts: Optional[List[str]] = None

class RefineScriptRequest(BaseModel):
    script: str
    feedback: str

class AudioRequest(BaseModel):
    script: str
    filename: Optional[str] = "generated_audio.mp3"

class VideoRequest(BaseModel):
    audio_url: str

class ImageGenerationRequest(BaseModel):
    product_url: str
    script: str
    num_alterations: Optional[int] = 2

# --- Endpoints ---

@app.post("/api/scrape")
async def scrape_product(request: ScrapeRequest):
    print(f"Scraping URL: {request.url}")
    data = scraper.scrape_url(request.url)
    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])
    return data

@app.post("/api/analyze")
async def analyze_product(request: AnalyzeRequest):
    if request.feedback and request.current_analysis:
        print("Refining analysis...")
        analysis = analyzer._refine_analysis(
            request.product_data, 
            request.feedback, 
            request.current_analysis
        )
    else:
        print("Generating initial analysis...")
        analysis = analyzer._generate_analysis(request.product_data, [])
    
    return analysis

@app.post("/api/scripts")
async def generate_scripts(request: ScriptRequest):
    if request.feedback and request.current_scripts:
        print("Refining scripts...")
        scripts = analyzer._refine_scripts(
            request.product_data,
            request.analysis,
            request.feedback,
            request.current_scripts
        )
    else:
        print("Generating initial scripts...")
        scripts = analyzer._generate_scripts(
            request.product_data,
            request.analysis,
            []
        )
    return {"scripts": scripts}

@app.post("/api/refine_script")
async def refine_script(request: RefineScriptRequest):
    print("Tweaking script...")
    refined_script = analyzer._tweak_script(request.script, request.feedback)
    return {"script": refined_script}

@app.post("/api/audio")
async def generate_audio(request: AudioRequest):
    print("Generating audio...")
    # Ensure output directory exists
    os.makedirs("static/audio", exist_ok=True)
    
    # We need to save it to a path that can be served or accessed.
    # For now, let's save it locally and return the path.
    # In a real app, we'd upload to S3 or serve via static files.
    
    # Since the voice_gen.generate_voice saves to a file, we'll use a path in static/audio
    filename = f"static/audio/{os.path.basename(request.filename)}"
    
    # The existing generate_voice method might expect just a filename or a path.
    # Let's check audioGeneration.py to be sure, but assuming it takes a path:
    audio_file = voice_gen.generate_voice(request.script, filename)
    
    if not audio_file:
        raise HTTPException(status_code=500, detail="Audio generation failed")
        
    return {"audio_file": audio_file, "url": f"/static/audio/{os.path.basename(audio_file)}"}

@app.post("/api/generate_images")
async def generate_images(request: ImageGenerationRequest):
    print(f"Generating images for {request.product_url}...")
    images = image_gen.generate_ad_creatives(
        request.product_url, 
        request.script, 
        request.num_alterations
    )
    
    if not images:
        raise HTTPException(status_code=500, detail="Failed to generate images")
        
    return {"images": images}

@app.get("/api/avatars")
async def get_avatars():
    avatars = heygen.get_avatars()
    return {"avatars": avatars}

@app.post("/api/heygen/upload")
async def upload_heygen_asset(request: AudioRequest):
    # We expect the filename to be in static/audio
    # But wait, the AudioRequest has script and filename. 
    # If we are uploading an existing file, we might need a different request model or just use the filename.
    # Let's assume the frontend sends the filename that was generated previously.
    
    file_path = f"static/audio/{os.path.basename(request.filename)}"
    if not os.path.exists(file_path):
         # Try without static/audio prefix if it's already full path or just name
         if os.path.exists(request.filename):
             file_path = request.filename
         else:
             raise HTTPException(status_code=404, detail="Audio file not found")
             
    asset_id = heygen.upload_asset(file_path)
    if not asset_id:
        raise HTTPException(status_code=500, detail="Failed to upload audio asset")
        
    return {"asset_id": asset_id}

class HeyGenVideoRequest(BaseModel):
    avatar_id: str
    audio_asset_id: str

@app.post("/api/heygen/generate")
async def generate_heygen_video(request: HeyGenVideoRequest):
    print(f"Generating video with Avatar: {request.avatar_id} and Asset: {request.audio_asset_id}")
    result = heygen.create_avatar_video(request.audio_asset_id, avatar_id=request.avatar_id, is_asset_id=True)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/api/video_status/{video_id}")
async def check_video_status(video_id: str):
    status = heygen.check_video_status(video_id)
    return status

# Mount static files to serve audio
from fastapi.staticfiles import StaticFiles
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
