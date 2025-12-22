# Vibelets Ad Campaign Workflow - Complete Architecture

## 🔄 Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/TypeScript)                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              VibeletsAPI Client (api.ts)                     │   │
│  │  • Manages thread_id across workflow                         │   │
│  │  • Handles all API calls to backend                          │   │
│  │  • Maintains session state                                   │   │
│  └────────────────────┬─────────────────────────────────────────┘   │
│                       │                                               │
└───────────────────────┼───────────────────────────────────────────────┘
                        │ HTTP/JSON
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI + LangGraph)                    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │             FastAPI Endpoints (server_langgraph.py)           │  │
│  │                                                                │  │
│  │  /api/workflow/scrape              → Scrape product           │  │
│  │  /api/workflow/analyze             → AI product analysis      │  │
│  │  /api/workflow/generate_scripts    → Generate 3 scripts       │  │
│  │  /api/workflow/select_script       → Select a script          │  │
│  │  /api/workflow/refine_script       → Refine with feedback     │  │
│  │  /api/workflow/generate_images     → Generate ad images       │  │
│  │  /api/workflow/refine_images       → Refine images            │  │
│  │  /api/workflow/generate_audio      → Generate voiceover       │  │
│  │  /api/workflow/avatars             → Get HeyGen avatars       │  │
│  │  /api/workflow/select_avatar       → Select avatar            │  │
│  │  /api/workflow/generate_video      → Generate video           │  │
│  │  /api/workflow/facebook_auth       → Facebook auth ✨         │  │
│  │  /api/workflow/select_ad_account   → Select ad account ✨     │  │
│  │  /api/workflow/select_media        → Select media ✨          │  │
│  │  /api/workflow/preview_campaign    → Preview campaign ✨      │  │
│  │  /api/workflow/refine_campaign     → Refine campaign ✨       │  │
│  │  /api/workflow/publish_campaign    → Publish to FB ✨         │  │
│  │  /api/workflow/navigate            → Navigate steps           │  │
│  │  /api/workflow/chat                → Chat interface           │  │
│  │  /api/workflow/state/{id}          → Get workflow state       │  │
│  │  /api/workflow/stream              → SSE streaming            │  │
│  └────────────────────┬──────────────────────────────────────────┘  │
│                       │                                               │
│                       ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         LangGraph Workflow (workflow_graph.py)                │  │
│  │                                                                │  │
│  │         ┌──────────┐                                          │  │
│  │         │  ROUTE   │ ◄─── Entry Point                         │  │
│  │         └─────┬────┘                                          │  │
│  │               │                                                │  │
│  │     ┌─────────┼─────────────────────────────┐                │  │
│  │     ▼         ▼         ▼         ▼         ▼                │  │
│  │  scrape   analyze   scripts   images   audio                 │  │
│  │     │         │         │         │         │                 │  │
│  │     ▼         ▼         ▼         ▼         ▼                 │  │
│  │  select   refine    select   refine   select_avatar          │  │
│  │  product  analysis  script   images   generate_video         │  │
│  │                                                                │  │
│  │                       ▼                                        │  │
│  │              ┌────────────────┐                               │  │
│  │              │  Facebook Flow │ ✨ NEW                        │  │
│  │              └────┬───────────┘                               │  │
│  │                   │                                            │  │
│  │         ┌─────────┼──────────────────┐                        │  │
│  │         ▼         ▼         ▼        ▼                        │  │
│  │   facebook_  select_ad  select_  preview_                     │  │
│  │     auth     account    media    campaign                     │  │
│  │         │         │         │        │                        │  │
│  │         └─────────┴─────────┴────────┘                        │  │
│  │                   │                                            │  │
│  │         ┌─────────┴──────────┐                                │  │
│  │         ▼                    ▼                                │  │
│  │   refine_campaign    publish_campaign                         │  │
│  │                              │                                │  │
│  │                              ▼                                │  │
│  │                            [END]                              │  │
│  └──────────────────────┬────────────────────────────────────────┘  │
│                         │                                             │
│                         ▼                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AI Agents                                  │  │
│  │                                                                │  │
│  │  • AnalysisAgent          → Product analysis                  │  │
│  │  • ScriptGenerationAgent  → Ad script creation                │  │
│  │  • ImageGenerationAgent   → Image prompt + generation         │  │
│  │  • NavigationAgent        → Intent detection                  │  │
│  │  • GuideAgent             → User guidance                     │  │
│  │  • CampaignCreationAgent  → FB campaign config ✨             │  │
│  │  • CampaignPreviewAgent   → Campaign preview ✨               │  │
│  │  • CampaignModificationAgent → Campaign refinement ✨         │  │
│  └────────────────────┬──────────────────────────────────────────┘  │
│                       │                                               │
└───────────────────────┼───────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                │
│                                                                       │
│  • OpenAI GPT-4          → AI analysis & generation                 │
│  • Google Gemini         → Image generation                         │
│  • ElevenLabs            → Voice synthesis                          │
│  • HeyGen                → Avatar video generation                  │
│  • Facebook Graph API    → Ad campaign publishing ✨                │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 State Flow

```
thread_id (UUID) → Persistent across entire workflow

WorkflowState = {
  current_step: string            // Current step in workflow
  navigation_intent: string       // Where to go next
  messages: array                 // Conversation history
  
  // Product Data
  url: string
  product_data: object
  selected_product: object
  
  // Analysis
  analysis: object
  analysis_feedback: array
  
  // Scripts
  scripts: array
  selected_script_index: number
  selected_script: object
  script_feedback: array
  script_refinement_feedback: array
  
  // Images
  generated_images: array
  image_feedback: array
  image_generation_prompt: string
  
  // Audio & Video
  audio_file: string
  audio_url: string
  available_avatars: array
  selected_avatar_id: string
  video_id: string
  video_url: string
  video_status: string
  
  // Facebook Campaign ✨
  facebook_access_token: string
  facebook_user_id: string
  ad_accounts: array
  selected_ad_account_id: string
  selected_media: object
  campaign_config: object
  campaign_preview: string
  publish_status: string
  final_campaign_id: string
  
  // Metadata
  error: string
  iteration_count: object
}
```

## 🎯 Complete User Journey

```
1. USER: "Create an ad for nike.com/air-max"
   ↓
2. FRONTEND: vibeletsAPI.scrapeProduct(url)
   ↓
3. BACKEND: Scrape → Extract product data
   ↓
4. FRONTEND: vibeletsAPI.analyzeProduct()
   ↓
5. BACKEND: AI Analysis → Target audience, USPs, angles
   ↓
6. FRONTEND: vibeletsAPI.generateScripts()
   ↓
7. BACKEND: Generate 3 script options
   ↓
8. USER: Selects script #2
   ↓
9. FRONTEND: vibeletsAPI.selectScript(1)
   ↓
10. FRONTEND: vibeletsAPI.generateImages()
    ↓
11. BACKEND: AI generates images via Google Gemini
    ↓
12. FRONTEND: vibeletsAPI.generateAudio()
    ↓
13. BACKEND: ElevenLabs voice synthesis
    ↓
14. FRONTEND: vibeletsAPI.selectAvatar(id)
    ↓
15. FRONTEND: vibeletsAPI.generateVideo()
    ↓
16. BACKEND: HeyGen creates avatar video
    ↓
17. FRONTEND: vibeletsAPI.authenticateFacebook(token) ✨
    ↓
18. BACKEND: Validate token, get ad accounts ✨
    ↓
19. FRONTEND: vibeletsAPI.selectAdAccount(id) ✨
    ↓
20. FRONTEND: vibeletsAPI.selectMedia('video', url) ✨
    ↓
21. FRONTEND: vibeletsAPI.previewCampaign() ✨
    ↓
22. BACKEND: AI generates campaign config ✨
    ↓
23. USER: Reviews and optionally refines
    ↓
24. FRONTEND: vibeletsAPI.publishCampaign() ✨
    ↓
25. BACKEND: Publish to Facebook Ads ✨
    ↓
26. SUCCESS! Campaign is live on Facebook! 🎉
```

## 📊 Data Flow Example

```json
// Initial Scrape
POST /api/workflow/scrape
{
  "url": "https://nike.com/air-max",
  "thread_id": "uuid-123"
}

// Response
{
  "thread_id": "uuid-123",
  "state": {
    "current_step": "scrape",
    "product_data": {
      "title": "Nike Air Max",
      "price": "$120",
      "description": "...",
      "images": [...]
    }
  }
}

// ... workflow continues ...

// Facebook Auth ✨
POST /api/workflow/facebook_auth
{
  "thread_id": "uuid-123",
  "access_token": "EAAB..."
}

// Response
{
  "thread_id": "uuid-123",
  "state": {
    "current_step": "facebook_auth",
    "facebook_user_id": "123456",
    "ad_accounts": [
      {"id": "act_789", "name": "My Ad Account"}
    ]
  }
}

// Publish Campaign ✨
POST /api/workflow/publish_campaign
{
  "thread_id": "uuid-123"
}

// Response
{
  "thread_id": "uuid-123",
  "state": {
    "current_step": "publish_campaign",
    "publish_status": "success",
    "final_campaign_id": "campaign_456"
  }
}
```

---

✨ **All endpoints are now integrated and ready to use!**
