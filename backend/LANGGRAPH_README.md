# LangGraph Workflow Architecture

This document describes the LangGraph-based state machine architecture for the ad campaign generation workflow.

## Overview

The workflow has been refactored to use LangGraph, providing:
- **Context-aware memory**: All steps remember previous selections and updates
- **Bidirectional navigation**: Users can navigate to any previous step
- **Chat-based editing**: All steps support refinement via simple chat messages
- **Agent integration**: Each step uses specialized LangChain agents

## Architecture

### State Schema (`state_schema.py`)

The `WorkflowState` TypedDict defines the complete state that persists across all steps:

- **Current step tracking**: Tracks which step the user is on
- **Navigation intent**: Allows users to specify where they want to go
- **Messages**: Chat history for editing
- **Step-specific data**: Product data, analysis, scripts, images, audio, video
- **Feedback history**: Tracks all refinements per step
- **Iteration counts**: Tracks how many times each step has been executed

### Workflow Graph (`workflow_graph.py`)

The `AdCampaignWorkflow` class builds a LangGraph state machine with:

1. **Nodes**: Each step is a node in the graph
   - `scrape`: Scrape product/store URL
   - `analyze`: Analyze product (agent-based)
   - `generate_scripts`: Generate 3 ad scripts (agent-based)
   - `select_script`: Select one script
   - `refine_script`: Refine selected script (agent-based)
   - `generate_images`: Generate images (agent-based)
   - `refine_images`: Refine images (agent-based)
   - `generate_audio`: Generate audio (Eleven Labs)
   - `select_avatar`: Select HeyGen avatar
   - `generate_video`: Generate lipsynced video

2. **Routing**: A `route` node handles navigation between steps
   - Can navigate forward or backward
   - Preserves context when navigating
   - Supports navigation via `navigation_intent` or `current_step`

### Agents (`agents.py`)

Specialized LangChain agents for each step:

- **AnalysisAgent**: Product analysis with chat-based refinement
- **ScriptGenerationAgent**: Script generation and refinement
- **ImageGenerationAgent**: Image prompt generation and refinement (uses Google Gemini for actual generation)

## API Endpoints (`server_langgraph.py`)

The new server provides workflow-based endpoints:

### Core Workflow Endpoints

- `POST /api/workflow/scrape` - Scrape product/store
- `POST /api/workflow/analyze` - Analyze product (with optional feedback)
- `POST /api/workflow/generate_scripts` - Generate scripts (with optional feedback)
- `POST /api/workflow/select_script` - Select a script by index
- `POST /api/workflow/refine_script` - Refine selected script
- `POST /api/workflow/generate_images` - Generate images (with optional feedback)
- `POST /api/workflow/refine_images` - Refine images
- `POST /api/workflow/generate_audio` - Generate audio
- `POST /api/workflow/select_avatar` - Select avatar
- `POST /api/workflow/generate_video` - Generate video

### Navigation & Chat

- `POST /api/workflow/navigate` - Navigate to any step
- `POST /api/workflow/chat` - Chat-based editing (auto-routes to current step)
- `GET /api/workflow/state/{thread_id}` - Get current state
- `GET /api/workflow/avatars` - Get available avatars

## Usage Examples

### Starting a New Campaign

```python
# 1. Scrape product
response = requests.post("http://localhost:8000/api/workflow/scrape", json={
    "url": "https://example.com/product"
})
thread_id = response.json()["thread_id"]

# 2. Analyze (with feedback)
response = requests.post("http://localhost:8000/api/workflow/analyze", json={
    "thread_id": thread_id,
    "feedback": "Focus more on the target audience"
})

# 3. Generate scripts
response = requests.post("http://localhost:8000/api/workflow/generate_scripts", json={
    "thread_id": thread_id
})

# 4. Select and refine script
response = requests.post("http://localhost:8000/api/workflow/select_script", json={
    "thread_id": thread_id,
    "script_index": 0
})

response = requests.post("http://localhost:8000/api/workflow/refine_script", json={
    "thread_id": thread_id,
    "feedback": "Make it more energetic"
})

# 5. Generate images
response = requests.post("http://localhost:8000/api/workflow/generate_images", json={
    "thread_id": thread_id,
    "feedback": "Make the background more vibrant"
})

# Continue with audio, avatar, video...
```

### Navigating Backward

```python
# Go back to analysis step
response = requests.post("http://localhost:8000/api/workflow/navigate", json={
    "thread_id": thread_id,
    "navigation_intent": "go to analyze"
})

# Update analysis with new feedback
response = requests.post("http://localhost:8000/api/workflow/analyze", json={
    "thread_id": thread_id,
    "feedback": "Add more details about pricing"
})
```

### Chat-Based Editing

```python
# Chat at current step (automatically routes to appropriate node)
response = requests.post("http://localhost:8000/api/workflow/chat", json={
    "thread_id": thread_id,
    "message": "Make the script shorter and punchier"
})
```

## Key Features

### 1. Context Preservation

When navigating backward, all previous work is preserved:
- Product data remains available
- Previous analysis is kept
- Generated scripts/images are not lost
- Selections are remembered

### 2. Bidirectional Navigation

Users can jump to any step:
- Forward: Continue to next step
- Backward: Go back to refine previous steps
- Skip: Jump directly to a later step (if prerequisites met)

### 3. Chat-Based Refinement

Every step supports chat-based editing:
- Analysis: "Focus more on millennials"
- Scripts: "Make it funnier"
- Images: "Use warmer colors"
- All feedback is stored in state for context

### 4. Agent Integration

Each step uses specialized agents:
- **AnalysisAgent**: Understands product context and marketing angles
- **ScriptGenerationAgent**: Creates engaging ad scripts
- **ImageGenerationAgent**: Generates detailed image prompts based on context

## State Management

The workflow uses LangGraph's checkpointing system:
- State is persisted per `thread_id`
- Each step can access full state history
- Navigation preserves all context
- Iteration counts track refinement cycles

## Migration from Old API

The old API endpoints (`/api/scrape`, `/api/analyze`, etc.) are still available in `server.py` for backward compatibility.

To migrate:
1. Use `server_langgraph.py` instead of `server.py`
2. Update frontend to use `/api/workflow/*` endpoints
3. Track `thread_id` for each user session
4. Use navigation endpoints for step navigation

## Running the Server

```bash
# Install dependencies
pip install -r requirements.txt

# Run LangGraph server
cd AgneticFlow
python server_langgraph.py
```

The server will start on `http://localhost:8000`

## Next Steps

1. Update frontend to use new workflow endpoints
2. Add UI for step navigation
3. Implement chat interface for each step
4. Add state visualization/debugging tools
5. Consider adding persistence layer (database) for state

