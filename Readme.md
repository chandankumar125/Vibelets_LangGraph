# Vibelets - AI-Powered Ad Campaign Generator

A full-stack application that uses LangGraph to generate ad campaigns with AI-driven product analysis, script generation, creative generation, and Facebook Ads integration.

## 🚀 Features

- **Product Analysis**: AI-powered analysis of product URLs
- **Script Generation**: Automated ad script creation
- **Creative Generation**: AI-generated images for ads
- **Avatar Selection**: Choose AI presenters for video ads
- **Video Generation**: HeyGen integration for avatar videos
- **Facebook Integration**: Direct publishing to Facebook Ads
- **Interactive Chat**: Natural language interface for campaign creation

## 📁 Project Structure

```
Vibelets_LangGraph/
├── backend/          # FastAPI + LangGraph backend
│   ├── server_langgraph.py  # Main API server
│   ├── workflow_graph.py    # LangGraph workflow definition
│   ├── agents.py             # LangChain agents
│   ├── facebook/             # Facebook Ads integration
│   └── ...
├── frontend/         # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API client & utilities
│   │   └── pages/            # App pages
│   └── ...
└── venv/            # Python virtual environment
```

## 🛠️ Setup Instructions

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment** (if not already created)
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Mac/Linux
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the `backend/` directory:
   ```env
   # Required: OpenAI API Key (for agents using GPT-4)
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Optional: Google AI API Key (for image generation with Gemini)
   GOOGLE_API_KEY=your_google_api_key_here
   
   # Required: HeyGen API Key (for avatar video generation)
   HEYGEN_API_KEY=your_heygen_api_key_here
   
   # Required: ElevenLabs API Key (for voice generation)
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   
   # Optional: Facebook API (for campaign publishing)
   FACEBOOK_APP_ID=your_facebook_app_id_here
   FACEBOOK_APP_SECRET=your_facebook_app_secret_here
   
   # Server Config
   HOST=0.0.0.0
   PORT=8000
   ```

5. **Run the backend server**
   ```bash
   uvicorn server_langgraph:app --reload
   ```

   The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

   The frontend will be available at `http://localhost:5173` (or another port if 5173 is busy)

## 🔑 Required API Keys

### Essential Keys

1. **OpenAI API Key** (Required)
   - Used for: Product analysis, script generation, navigation agents
   - Get it from: https://platform.openai.com/api-keys
   - Models used: GPT-4

2. **HeyGen API Key** (Required for video generation)
   - Used for: AI avatar video generation
   - Get it from: https://www.heygen.com/
   
3. **ElevenLabs API Key** (Required for audio)
   - Used for: Voice-over generation
   - Get it from: https://elevenlabs.io/

### Optional Keys

4. **Google AI API Key** (Optional, for Gemini-based image generation)
   - Used for: Alternative image generation using Gemini
   - Get it from: https://makersuite.google.com/app/apikey
   - Note: If not provided, some image generation features may be limited

5. **Facebook App Credentials** (Optional, for publishing campaigns)
   - Required for: Publishing campaigns directly to Facebook Ads
   - Get them from: https://developers.facebook.com/

## 🔧 Troubleshooting

### Backend Issues

**Error: "Missing key inputs argument! To use the Google AI API..."**
- This means the `GOOGLE_API_KEY` is not set in your `.env` file
- Solution: Add `GOOGLE_API_KEY=your_key_here` to `backend/.env`
- Or comment out Google Gemini imports in `image_generation.py` if you don't need that feature

**Error: "Module not found"**
- Make sure you've installed all dependencies: `pip install -r requirements.txt`
- Check that your virtual environment is activated

**Error: "facebook module not found"**
- This was fixed by adding `__init__.py` to the `facebook/` directory
- Make sure the file exists at `backend/facebook/__init__.py`

### Frontend Issues

**Error: "Cannot connect to API"**
- Check that the backend is running on `http://localhost:8000`
- Verify the `VITE_API_BASE_URL` in `frontend/.env` is correct
- Check browser console for CORS errors

## 📚 API Documentation

Once the backend is running, visit:
- API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## 🎯 Workflow Steps

The application follows this workflow:

1. **Scrape** - Input product URL
2. **Analyze** - AI analyzes product and target audience
3. **Generate Scripts** - AI creates 3 script variations
4. **Select Script** - Choose your preferred script
5. **Refine Script** - Edit the selected script
6. **Generate Images** - AI creates ad visuals
7. **Generate Audio** - Create voice-over
8. **Select Avatar** - Choose AI presenter
9. **Generate Video** - Create final video
10. **Facebook Auth** - Connect Facebook account
11. **Select Ad Account** - Choose FB ad account
12. **Preview Campaign** - Review configuration
13. **Publish** - Launch the campaign

## 📦 Tech Stack

**Backend:**
- FastAPI - API framework
- LangGraph - Workflow orchestration
- LangChain - LLM integration
- OpenAI GPT-4 - Language model
- Google Gemini - Image generation (optional)
- HeyGen - Avatar videos
- ElevenLabs - Voice generation

**Frontend:**
- React - UI framework
- TypeScript - Type safety
- Vite - Build tool
- TailwindCSS - Styling
- shadcn/ui - UI components

## 🤝 Contributing

This is a private project. For issues or questions, contact the development team.

## 📝 License

Proprietary - All rights reserved
