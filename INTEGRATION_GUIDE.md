# Integration Guide: Frontend ↔ Backend Connection

## ✅ What I've Fixed

### 1. Fixed the `facebook` Module Error
- **Problem**: The `facebook` directory wasn't recognized as a Python package
- **Solution**: Created `backend/facebook/__init__.py` with proper imports
- **Status**: ✅ Fixed

### 2. Created API Client for Frontend
- **Location**: `frontend/src/lib/api.ts`
- **Features**:
  - Complete TypeScript API client
  - All backend endpoints covered
  - Singleton pattern for session management
  - Streaming support for real-time updates
- **Status**: ✅ Ready to use

### 3. Environment Configuration
- **Backend**: Created `backend/env.example` with all required API keys
- **Frontend**: Created `frontend/env.example` for API URL configuration
- **Status**:  Needs API keys to be added

## 🔧 What You Need to Do

### Step 1: Add API Keys to Backend

Create a `.env` file in the `backend/` directory with:

```env
# CRITICAL - Without this, the backend won't start
OPENAI_API_KEY=sk-...your-openai-key...

# OPTIONAL - Only if using Gemini for image generation
GOOGLE_API_KEY=...your-google-key...

# For avatar video generation
HEYGEN_API_KEY=...your-heygen-key...

# For voice generation
ELEVENLABS_API_KEY=...your-elevenlabs-key...
```

### Step 2: Create Frontend .env File

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

### Step 3: Start the Servers

**Backend:**
```bash
cd backend
uvicorn server_langgraph:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## 📊 Current Error Explanation

**Error Message:**
```
ValueError: Missing key inputs argument! To use the Google AI API, provide (`api_key`) arguments.
```

**Why This Happens:**
- The `image_generation.py` file imports Google Gemini AI
- It's initialized when the backend starts
- Without `GOOGLE_API_KEY` in the `.env` file, it fails

**Quick Fixes:**

**Option A: Add the key (Recommended)**
```env
GOOGLE_API_KEY=your_google_api_key_here
```

**Option B: Disable Gemini (if you don't need it)**
Edit `backend/image_generation.py` and comment out the Google imports.

## 🔗 How to Integrate Frontend with Backend

### Using the API Client

The frontend already has `useCampaignFlow.ts` which manages state. You can integrate the backend API like this:

```typescript
// frontend/src/lib/api.ts is already created!
import { vibeletsAPI } from '@/lib/api';

// Example usage in your hooks or components:

// 1. Scrape a product
const handleProductUrl = async (url: string) => {
  try {
    const response = await vibeletsAPI.scrapeProduct(url);
    // response.state contains the workflow state
    // response.product_data contains scraped data
  } catch (error) {
    console.error('Failed to scrape:', error);
  }
};

// 2. Generate scripts
const handleGenerateScripts = async () => {
  try {
    const response = await vibeletsAPI.generateScripts();
    // response.scripts contains the generated scripts
  } catch (error) {
    console.error('Failed to generate scripts:', error);
  }
};

// 3. Stream real-time updates
const handleStreamWorkflow = async (message: string) => {
  try {
    for await (const event of vibeletsAPI.streamWorkflow(message)) {
      if (event.type === 'token') {
        // Display streaming text
        console.log(event.content);
      } else if (event.type === 'complete') {
        // Workflow complete, update state
        console.log('Final state:', event.state);
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
  }
};
```

### Integration Points

Replace mock data in `useCampaignFlow.ts` with real API calls:

1. **Product Scraping** (Line ~199):
   ```typescript
   // Instead of: setState(prev => ({ ...prev, productData: mockProductData }))
   const response = await vibeletsAPI.scrapeProduct(sanitizedContent);
   setState(prev => ({ ...prev, productData: response.product_data }));
   ```

2. **Script Generation** (Line ~346):
   ```typescript
   // Instead of using scriptOptions
   const response = await vibeletsAPI.generateScripts();
   setState(prev => ({ ...prev, scripts: response.scripts }));
   ```

3. **Avatar Generation** (Line ~447):
   ```typescript
   const response = await vibeletsAPI.generateVideo();
   setState(prev => ({ ...prev, videoUrl: response.video_url }));
   ```

## 🎯 Backend Endpoints Available

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workflow/scrape` | POST | Scrape product URL |
| `/api/workflow/analyze` | POST | Analyze product |
| `/api/workflow/generate_scripts` | POST | Generate ad scripts |
| `/api/workflow/select_script` | POST | Select a script |
| `/api/workflow/refine_script` | POST | Refine selected script |
| `/api/workflow/generate_images` | POST | Generate images |
| `/api/workflow/refine_images` | POST | Refine images |
| `/api/workflow/generate_audio` | POST | Generate audio |
| `/api/workflow/select_avatar` | POST | Select avatar |
| `/api/workflow/avatars` | GET | Get available avatars |
| `/api/workflow/generate_video` | POST | Generate video |
| `/api/workflow/chat` | POST | Send chat message |
| `/api/workflow/navigate` | POST | Navigate workflow |
| `/api/workflow/state/{thread_id}` | GET | Get current state |
| `/api/workflow/stream` | GET | Stream events (SSE) |

## 📝 Next Steps

1. ✅ Add your API keys to `backend/.env`
2. ✅ Create `frontend/.env` with the API URL
3. 🔄 Start both servers
4. 🔄 Replace mock data in `useCampaignFlow.ts` with real API calls
5. 🔄 Test the workflow end-to-end
6. 🔄 Add error handling and loading states

## 💡 Tips

- Use the `thread_id` to maintain conversation context
- The backend maintains state in `active_sessions`
- Stream API provides real-time token streaming for better UX
- All endpoints return the current workflow state

## ⚠️ Important Notes

1. **Google API Key**: If you don't have it, the backend will fail to start due to `image_generation.py`
2. **OpenAI API Key**: This is REQUIRED - the agents use GPT-4
3. **CORS**: Already configured to accept all origins in development
4. **State Management**: The backend maintains session state, so refreshing the frontend page will lose context unless you persist the `thread_id`

## 🐛 Debugging

If backend fails to start:
1. Check `.env` file exists in `backend/` directory
2. Verify all REQUIRED keys are present
3. Check the terminal output for specific error messages
4. Try commenting out Google Gemini imports in `image_generation.py` if you don't need them

If frontend can't connect:
1. Verify backend is running on `http://localhost:8000`
2. Check CORS errors in browser console
3. Verify `VITE_API_BASE_URL` in frontend `.env`
4. Try accessing `http://localhost:8000/docs` to see if API is responsive
