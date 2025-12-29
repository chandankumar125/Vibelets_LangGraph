"""
LangGraph workflow for ad campaign generation
Supports bidirectional navigation and context-aware memory
"""
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# ... existing imports ...
from state_schema import WorkflowState
from scraper import ProductScraper
from agents import AnalysisAgent, ScriptGenerationAgent, ImageGenerationAgent, NavigationAgent, GuideAgent
from audioGeneration import ElevenLabsVoiceGenerator
from heygen import HeyGenAvatarIntegrator
# Facebook integration
from facebook_agents import (
    CampaignCreationAgent, CampaignPreviewAgent, CampaignModificationAgent,
    authenticate_user, create_campaign, create_adset, create_video_ad, create_image_ad
)
from media_manager import MediaManager
import os
import json


class AdCampaignWorkflow:
    """LangGraph-based workflow with bidirectional navigation"""
    
    def __init__(self):
        self.scraper = ProductScraper()
        self.analysis_agent = AnalysisAgent()
        self.script_agent = ScriptGenerationAgent()
        self.image_agent = ImageGenerationAgent()
        self.audio_gen = ElevenLabsVoiceGenerator()
        self.heygen = HeyGenAvatarIntegrator()
        self.navigation_agent = NavigationAgent()
        self.guide_agent = GuideAgent()
        
        # Facebook Agents
        self.media_manager = MediaManager()
        self.campaign_creation_agent = CampaignCreationAgent()
        self.campaign_preview_agent = CampaignPreviewAgent()
        self.campaign_modification_agent = CampaignModificationAgent()
        
        # Build the graph
        self.graph = self._build_graph()
        
        # Add memory for checkpointing
        self.memory = MemorySaver()
        self.app = self.graph.compile(checkpointer=self.memory)
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine"""
        workflow = StateGraph(WorkflowState)
        
        # Add nodes for each step
        workflow.add_node("scrape", self._scrape_node)
        workflow.add_node("analyze", self._analyze_node)
        workflow.add_node("generate_scripts", self._generate_scripts_node)
        workflow.add_node("select_script", self._select_script_node)
        workflow.add_node("refine_script", self._refine_script_node)
        workflow.add_node("generate_images", self._generate_images_node)
        workflow.add_node("refine_images", self._refine_images_node)
        workflow.add_node("generate_audio", self._generate_audio_node)
        workflow.add_node("select_avatar", self._select_avatar_node)
        workflow.add_node("generate_video", self._generate_video_node)
        
        # Facebook Integration Nodes
        workflow.add_node("facebook_auth", self._facebook_auth_node)
        workflow.add_node("select_ad_account", self._select_ad_account_node)
        workflow.add_node("select_media", self._select_media_node)
        workflow.add_node("preview_campaign", self._generate_campaign_preview_node)
        workflow.add_node("refine_campaign", self._refine_campaign_node)
        workflow.add_node("publish_campaign", self._publish_campaign_node)
        
        workflow.add_node("route", self._route_node)
        
        # Set entry point
        workflow.set_entry_point("route")
        
        # Define edges - all nodes route to END to wait for next interaction
        workflow.add_edge("scrape", END)
        workflow.add_edge("analyze", END)
        workflow.add_edge("generate_scripts", END)
        workflow.add_edge("select_script", END)
        workflow.add_edge("refine_script", END)
        workflow.add_edge("generate_images", END)
        workflow.add_edge("refine_images", END)
        workflow.add_edge("generate_audio", END)
        workflow.add_edge("select_avatar", END)
        workflow.add_edge("select_avatar", END)
        workflow.add_edge("generate_video", END)
        workflow.add_edge("facebook_auth", END)
        workflow.add_edge("select_ad_account", END)
        workflow.add_edge("select_media", END)
        workflow.add_edge("preview_campaign", END)
        workflow.add_edge("refine_campaign", END)
        workflow.add_edge("publish_campaign", END)
        
        # Route node conditionally routes to next step or END
        workflow.add_conditional_edges(
            "route",
            self._route_logic,
            {
                "scrape": "scrape",
                "analyze": "analyze",
                "generate_scripts": "generate_scripts",
                "select_script": "select_script",
                "refine_script": "refine_script",
                "generate_images": "generate_images",
                "refine_images": "refine_images",
                "generate_audio": "generate_audio",
                "select_avatar": "select_avatar",
                "generate_video": "generate_video",
                "facebook_auth": "facebook_auth",
                "select_ad_account": "select_ad_account",
                "select_media": "select_media",
                "preview_campaign": "preview_campaign",
                "refine_campaign": "refine_campaign",
                "publish_campaign": "publish_campaign",
                END: END
            }
        )
        
        return workflow
    
    async def _route_node(self, state: WorkflowState) -> Dict[str, Any]:
        """Entry point node that determines navigation"""
        # Check for explicit intent in user message
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                content = last_msg.get("content", "").lower()
                
                # 1. Facebook Start Intent
                if "facebook" in content and ("campaign" in content or "create" in content or "start" in content):
                    print("Detected explicit Facebook campaign intent")
                    intent = "facebook_auth"
                    temp_state = state.copy()
                    temp_state["current_step"] = intent
                    agent_message = "Starting Facebook campaign creation. Please authenticate to continue."
                    return {"navigation_intent": intent, "agent_message": agent_message}

                # 2. Switch Ad Account Intent
                if "account" in content and ("switch" in content or "change" in content or "different" in content or "another" in content or "choose" in content or "select" in content or "pick" in content):
                    if state.get("facebook_access_token"):
                        print("Detected intent to switch ad account")
                        intent = "select_ad_account"
                        return {"navigation_intent": intent, "agent_message": "Sure, let's switch ad accounts."}
                    else:
                        print("Detected intent to switch account, but not authenticated -> Redirecting to Auth")
                        intent = "facebook_auth"
                        return {"navigation_intent": intent, "agent_message": "Please connect your Facebook account first before selecting an ad account."}

        # Try to detect script selection intent directly for speed/reliability
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                content = last_msg.get("content", "").lower()
                import re
                if re.search(r'\b(script|option|choice)\s*\d+\b', content):
                    print(f"DEBUG: Direct script selection detected: {content}")
                    intent = "select_script"
                    state["navigation_intent"] = intent

        # Analyze intent using agent if not already provided
        intent = state.get("navigation_intent")
        
        if not intent:
            result = await self.navigation_agent.analyze_intent(state)
            intent = result.get("intent")
            print(f"Navigation Intent: {intent} (Reason: {result.get('reasoning')})")
        else:
            print(f"Using provided Navigation Intent: {intent}")
        
        # Map 'next' to the actual next step based on current_step
        if intent == "next":
            current = state.get("current_step")
            if current == "product-url":
                intent = "analyze"
            elif current == "product-analysis":
                intent = "generate_scripts"
            elif current == "script-selection":
                intent = "generate_images"
            elif current == "creative-generation" or current.startswith("creative-generation:"):
                intent = "creative-review"
            elif current == "creative-review":
                intent = "campaign-setup"
            elif current == "avatar-selection":
                intent = "generate_video"
            elif current == "generate_video":
                intent = "facebook_auth"
            elif current == "facebook_auth":
                intent = "select_ad_account"
            else:
                # Fallback for old names just in case
                if current == "scrape": intent = "analyze"
                elif current == "analyze": intent = "generate_scripts"
                else: intent = "analyze" # Safe default for start
        
        # Map 'stay' to current step
        if intent == "stay":
            intent = state.get("current_step")
        
        # Mapping for the actual node names in the graph
        intent_to_node = {
            "scrape": "scrape",
            "analyze": "analyze",
            "generate_scripts": "generate_scripts",
            "select_script": "select_script",
            "refine_script": "refine_script",
            "generate_images": "generate_images",
            "refine_images": "refine_images",
            "generate_audio": "generate_audio",
            "select_avatar": "select_avatar",
            "generate_video": "generate_video",
            "facebook_auth": "facebook_auth",
            "select_ad_account": "select_ad_account",
            "select_media": "select_media",
            "preview_campaign": "preview_campaign",
            "refine_campaign": "refine_campaign",
            "publish_campaign": "publish_campaign"
        }
        
        # Ensure intent maps to a valid node
        if intent in intent_to_node:
            pass
        else:
            # Simple fuzzy match if needed
            for k in intent_to_node:
                if k and str(k) in str(intent).lower():
                    intent = k
                    break
            
        # Generate friendly guidance
        # We temporarily update state with new intent to generate relevant guidance
        temp_state = state.copy()
        temp_state["current_step"] = intent
        agent_message = await self.guide_agent.generate_guidance(temp_state)
            
        return {"navigation_intent": intent, "agent_message": agent_message}

    def _route_logic(self, state: WorkflowState) -> str:
        """Route to the appropriate step based on navigation_intent."""
        intent = state.get("navigation_intent")
        current_step = state.get("current_step", "scrape")
        
        # If intent is a valid step name, go there
        valid_steps = [
            "scrape", "analyze", "generate_scripts", "select_script", 
            "refine_script", "generate_images", "refine_images", 
            "refine_script", "generate_images", "refine_images", 
            "generate_audio", "select_avatar", "generate_video",
            "facebook_auth", "select_ad_account", "select_media",
            "preview_campaign", "refine_campaign", "publish_campaign"
        ]
        
        if intent in valid_steps:
            return intent
        elif intent == "complete":
            return END
            
        # Fallback to current step or END
        return current_step if current_step in valid_steps else END
    
    def _scrape_node(self, state: WorkflowState) -> WorkflowState:
        """Scrape product/store URL"""
        # Update current_step in state
        state["current_step"] = "product-url"
        url = state.get("url")
        
        # If no URL in state, check if the last message contains a URL
        if not url:
            messages = state.get("messages", [])
            if messages:
                last_msg = messages[-1]
                if last_msg.get("role") == "user":
                    content = last_msg.get("content", "")
                    # Simple check for URL
                    if "http" in content or "www" in content:
                        # Extract URL - simple split for now, can be more robust
                        words = content.split()
                        for word in words:
                            if "http" in word or "www" in word:
                                url = word
                                state["url"] = url
                                break
        
        if not url:
            state["error"] = "No URL provided"
            return state
        
        # Check if we already have product data and the URL matches what we successfully scraped
        if state.get("product_data") and state.get("scraped_url") == url:
            # Already scraped, return existing data
            print(f"DEBUG: Using cached scrape data for {url}")
            return state
        
        print(f"DEBUG: Scraping new URL: {url}")
        try:
            product_data = self.scraper.scrape_url(url)
            
            if "error" in product_data:
                state["error"] = product_data["error"]
                return state
            
            state["product_data"] = product_data
            state["selected_product"] = product_data  # Default to the scraped product
            state["scraped_url"] = url # Mark this URL as successfully scraped
            
            # Handle store selection if needed
            if product_data.get("is_store") and product_data.get("products"):
                # For now, use first product or let frontend handle selection
                # Frontend can update selected_product via API
                pass
            
            # Update iteration count
            if "iteration_count" not in state:
                state["iteration_count"] = {}
            state["iteration_count"]["scrape"] = state["iteration_count"].get("scrape", 0) + 1
            
        except Exception as e:
            error_msg = str(e)
            print(f"ERROR in scrape_node: {error_msg}")
            # Check if it's an API key issue
            if "api key" in error_msg.lower() or "unauthorized" in error_msg.lower():
                state["error"] = "Firecrawl API key not configured. Please set FIRECRAWL_API_KEY environment variable."
            else:
                state["error"] = f"Failed to scrape product: {error_msg}"
            return state
        
        return state
    
    async def _analyze_node(self, state: WorkflowState) -> WorkflowState:
        """Analyze product using agent"""
        # Update current_step in state
        state["current_step"] = "product-analysis"
        
        product_data = state.get("selected_product") or state.get("product_data")
        if not product_data:
            state["error"] = "No product data available. Please scrape first."
            return state
        
        # Get feedback history
        feedback_history = state.get("analysis_feedback", [])
        
        # Check if user provided new feedback in messages
        messages = state.get("messages", [])
        if messages:
            latest_message = messages[-1]
            if latest_message.get("role") == "user" and latest_message.get("content"):
                feedback_history.append(latest_message["content"])
                state["analysis_feedback"] = feedback_history
        
        # Prepare product data with current analysis for refinement
        if state.get("analysis"):
            product_data["current_analysis"] = state["analysis"]
        
        try:
            # Generate or refine analysis
            analysis = await self.analysis_agent.analyze(product_data, feedback_history)
            
            # Apply corrections if AI found missing info (like price or SKU) in raw text
            if isinstance(analysis, dict) and "corrections" in analysis:
                corrections = analysis.pop("corrections")
                if corrections:
                    print(f"DEBUG: Applying AI corrections to product data: {corrections}")
                    for k, v in corrections.items():
                        if v and v != "None":
                            product_data[k] = v
                    state["product_data"] = product_data
                    state["selected_product"] = product_data

            state["analysis"] = analysis
            
        except Exception as e:
            error_msg = str(e)
            print(f"ERROR in analyze_node: {error_msg}")
            if "api key" in error_msg.lower() or "openai" in error_msg.lower():
                state["error"] = "OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
            else:
                state["error"] = f"Failed to analyze product: {error_msg}"
            return state
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["analyze"] = state["iteration_count"].get("analyze", 0) + 1
        
        return state
    
    async def _generate_scripts_node(self, state: WorkflowState) -> WorkflowState:
        """Generate ad scripts using agent"""
        # Update current_step in state
        state["current_step"] = "script-selection"
        
        product_data = state.get("selected_product") or state.get("product_data")
        analysis = state.get("analysis")
        
        if not product_data:
            state["error"] = "No product data available. Please scrape first."
            return state
        
        if not analysis:
            state["error"] = "No analysis available. Please analyze product first."
            return state

        # CHECK FOR EXISTING DATA: If scripts already exist, don't regenerate
        if state.get("scripts") and len(state.get("scripts")) > 0:
            print("DEBUG: Scripts already exist, skipping regeneration.")
            return state
        
        # Get feedback history
        feedback_history = state.get("script_feedback", [])
        
        # Check if user provided new feedback in messages
        messages = state.get("messages", [])
        if messages:
            latest_message = messages[-1]
            if latest_message.get("role") == "user" and latest_message.get("content"):
                feedback_history.append(latest_message["content"])
                state["script_feedback"] = feedback_history
        
        # Prepare for refinement if scripts already exist
        if state.get("scripts"):
            product_data["current_scripts"] = state["scripts"]
        
        # Debug: Print analysis data to verify it's being passed correctly
        print(f"DEBUG: Analysis data passed to script agent: {json.dumps(analysis, indent=2) if analysis else 'None'}")
        if analysis:
            print(f"DEBUG: Target Audience: {analysis.get('target_audience')}")
            print(f"DEBUG: USPs: {analysis.get('usps')}")
            print(f"DEBUG: Marketing Angles: {analysis.get('marketing_angles')}")

        # Generate or refine scripts
        scripts = await self.script_agent.generate_scripts(product_data, analysis, feedback_history)
        state["scripts"] = scripts
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["generate_scripts"] = state["iteration_count"].get("generate_scripts", 0) + 1
        
        return state
    
    def _select_script_node(self, state: WorkflowState) -> WorkflowState:
        """Select a script based on user input or state"""
        # Update current_step in state
        state["current_step"] = "select_script"
        
        scripts = state.get("scripts")
        script_index = state.get("selected_script_index")
        
        if not scripts:
            state["error"] = "No scripts available. Please generate scripts first."
            return state
            
        # Try to parse selection from chat if index not set
        if script_index is None:
            messages = state.get("messages", [])
            if messages:
                last_msg = messages[-1]
                if last_msg.get("role") == "user" and last_msg.get("content"):
                    content = last_msg.get("content", "").lower()
                    # Check for "option X" or "script X" or just "X"
                    import re
                    match = re.search(r'(?:option|script)?\s*(\d+)', content)
                    if match:
                        try:
                            idx = int(match.group(1)) - 1  # Convert 1-based to 0-based
                            if 0 <= idx < len(scripts):
                                script_index = idx
                                state["selected_script_index"] = idx
                        except ValueError:
                            pass
        
        if script_index is None or script_index < 0 or script_index >= len(scripts):
            # Don't error out immediately, just wait for valid selection
            # state["error"] = f"Invalid script index. Please select 0-{len(scripts)-1}"
            return state
        
        state["selected_script"] = scripts[script_index]
        return state
    
    async def _refine_script_node(self, state: WorkflowState) -> WorkflowState:
        """Refine selected script using agent"""
        # Update current_step in state
        state["current_step"] = "refine_script"
        
        selected_script = state.get("selected_script")
        if not selected_script:
            state["error"] = "No script selected. Please select a script first."
            return state
        
        # Get feedback from messages
        messages = state.get("messages", [])
        if messages:
            latest_message = messages[-1]
            if latest_message.get("role") == "user" and latest_message.get("content"):
                feedback = latest_message["content"]
                refined = await self.script_agent.refine_script(selected_script, feedback)
                state["selected_script"] = refined
                if "script_refinement_feedback" not in state:
                    state["script_refinement_feedback"] = []
                state["script_refinement_feedback"].append(feedback)
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["refine_script"] = state["iteration_count"].get("refine_script", 0) + 1
        
        return state
    
    async def _generate_images_node(self, state: WorkflowState) -> WorkflowState:
        """Generate images using agent"""
        # Update current_step in state
        state["current_step"] = "creative-generation:images"
        
        product_data = state.get("selected_product") or state.get("product_data")
        selected_script = state.get("selected_script")
        analysis = state.get("analysis")
        
        if not product_data or not product_data.get("url"):
            state["error"] = "No product URL available. Please scrape first."
            return state
        
        if not selected_script:
            state["error"] = "No script selected. Please select a script first."
            return state

        # CHECK FOR EXISTING DATA: If images already exist, don't regenerate
        # Unless refinement is explicitly requested (checked by verifying if we are in refine_images or receiving new feedback)
        # For now, strict check: if images exist in state, return them.
        existing_images = state.get("generated_images", [])
        if existing_images and len(existing_images) > 0:
             # Check if this is a refinement step or just navigation
             # If step is specifically 'refine_images', we might want to proceed IF there's new feedback
             # But basic 'back/next' navigation shouldn't trigger this.
             # We can check if the last message was a "navigation" intent vs "refinement" intent
             # For safety, if images exist, we default to skipping unless there's a strong signal.
             print("DEBUG: Images already exist, skipping regeneration.")
             return state
        
        # Generate or refine image prompt
        image_feedback = state.get("image_feedback", [])
        current_prompt = state.get("image_generation_prompt")
        
        # Check if user provided new feedback in messages
        messages = state.get("messages", [])
        feedback = None
        if messages:
            latest_message = messages[-1]
            if latest_message.get("role") == "user" and latest_message.get("content"):
                feedback = latest_message["content"]
                image_feedback.append(feedback)
                state["image_feedback"] = image_feedback
        
        # Generate prompt using agent
        image_prompt = await self.image_agent.generate_prompt(
            product_data,
            selected_script,
            analysis,
            feedback if feedback else None
        )
        state["image_generation_prompt"] = image_prompt
        
        # Prepare base image if available to avoid re-scraping
        base_image = None
        product_data = state.get("selected_product") or state.get("product_data") or {}
        downloaded_images = product_data.get("downloaded_images", [])
        
        if downloaded_images:
            try:
                from PIL import Image
                # Convert web path to local path (/static/scraped_products/img.jpg -> static/scraped_products/img.jpg)
                local_path = downloaded_images[0].lstrip("/")
                if os.path.exists(local_path):
                    with Image.open(local_path) as img:
                        # Force load into memory to avoid lazy-loading issues in threads
                        img.load()
                        base_image = img.copy()
            except Exception as e:
                print(f"Failed to load existing image: {e}")

        # Generate images using agent
        product_url = product_data.get("url")
        print("DEBUG: Invoking ImageGenerationAgent...")
        images = self.image_agent.generate_images(
            product_url, 
            image_prompt, 
            num_images=2,
            base_image=base_image
        )
        state["generated_images"] = images
        
        # Fallback to product images if generation failed
        if not images or len(images) == 0:
            print("⚠️ Image generation failed or returned no images. Falling back to original product images.")
            state["generated_images"] = downloaded_images if downloaded_images else product_data.get("images", [])
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["generate_images"] = state["iteration_count"].get("generate_images", 0) + 1
        
        return state
    
    async def _refine_images_node(self, state: WorkflowState) -> WorkflowState:
        """Refine images (regenerate with new prompt)"""
        # Update current_step in state
        state["current_step"] = "refine_images"
        # This is essentially the same as generate_images but with explicit feedback
        return await self._generate_images_node(state)
    
    def _generate_audio_node(self, state: WorkflowState) -> WorkflowState:
        """Generate audio using Eleven Labs"""
        # Update current_step in state
        state["current_step"] = "creative-generation:audio"
        
        selected_script = state.get("selected_script")
        if not selected_script:
            state["error"] = "No script selected. Please select a script first."
            return state
        
        # Check if audio already exists (if navigating back)
        if state.get("audio_file") and os.path.exists(state["audio_file"]):
            return state
        
        # Generate audio
        os.makedirs("static/audio", exist_ok=True)
        filename = f"static/audio/generated_audio_{state.get('iteration_count', {}).get('generate_audio', 0)}.mp3"
        audio_file = self.audio_gen.generate_voice(selected_script, filename)
        
        if audio_file:
            state["audio_file"] = audio_file
            state["audio_url"] = f"/static/audio/{os.path.basename(audio_file)}"
        else:
            state["error"] = "Audio generation failed"
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["generate_audio"] = state["iteration_count"].get("generate_audio", 0) + 1
        
        return state
    
    def _select_avatar_node(self, state: WorkflowState) -> WorkflowState:
        """Select HeyGen avatar"""
        # Update current_step in state
        state["current_step"] = "avatar-selection"
        
        # Fetch avatars if not already fetched
        if not state.get("available_avatars"):
            avatars = self.heygen.get_avatars()
            # User requested to limit number of avatars displayed/fetched
            state["available_avatars"] = avatars[:10] if avatars else []
        
        # Avatar selection is handled by frontend
        # This node just validates that an avatar is selected
        avatar_id = state.get("selected_avatar_id")
        if not avatar_id:
            # Default to first avatar if none selected
            avatars = state.get("available_avatars", [])
            if avatars:
                state["selected_avatar_id"] = avatars[0].get("avatar_id")
        
        return state
    
    def _generate_video_node(self, state: WorkflowState) -> WorkflowState:
        """Generate HeyGen video"""
        # Update current_step in state
        state["current_step"] = "creative-generation:video"
        
        audio_file = state.get("audio_file")
        avatar_id = state.get("selected_avatar_id")
        
        if not audio_file:
            state["error"] = "No audio file available. Please generate audio first."
            return state
        
        if not avatar_id:
            state["error"] = "No avatar selected. Please select an avatar first."
            return state

        # CHECK FOR EXISTING DATA: If video already exists (ID is present), don't regenerate
        if state.get("video_id"):
             print(f"DEBUG: Video already exists ({state.get('video_id')}), skipping regeneration.")
             return state
        
        # Upload audio to HeyGen if not already uploaded
        # For now, we'll assume the audio needs to be uploaded each time
        # In production, you might want to cache the asset_id
        asset_id = self.heygen.upload_asset(audio_file)
        
        if not asset_id:
            print("Failed to upload audio, skipping HeyGen video...")
            # state["error"] = "Failed to upload audio to HeyGen"
            # return state
        else:
             # Try to find a background image
            background_url = None
            # 1. Try first generated image (if it's a public URL)
            gen_images = state.get("generated_images", [])
            if gen_images:
                for img in gen_images:
                    if img.startswith('http') and 'localhost' not in img and '127.0.0.1' not in img:
                        background_url = img
                        break
            
            if not background_url:
                prod_data = state.get("selected_product") or state.get("product_data") or {}
                prod_images = prod_data.get("images", [])
                for img in prod_images:
                    if img.startswith('http') and 'localhost' not in img and '127.0.0.1' not in img:
                        background_url = img
                        break

            print(f"🎬 Creating HeyGen video with background: {background_url} and aspect ratio: {state.get('video_aspect_ratio', '9:16')}")
            
            result = self.heygen.create_avatar_video(
                asset_id, 
                avatar_id=avatar_id, 
                background_url=background_url,
                video_aspect_ratio=state.get('video_aspect_ratio', '9:16')
            )
            
            if "error" in result:
                print(f"⚠️ Initial video generation failed: {result['error']}")
                
                # Retry without background if that was the issue, OR just fall back to mock
                if background_url:
                    print(f"🔄 Retrying video generation WITHOUT background...")
                    result = self.heygen.create_avatar_video(
                        asset_id, 
                        avatar_id=avatar_id, 
                        background_url=None,
                        video_aspect_ratio=state.get('video_aspect_ratio', '9:16')
                    )
            
            if "video_id" in result:
                state["video_id"] = result["video_id"]
                state["video_status"] = "pending"
                state["video_url"] = None  # Will be polled
                
                # Update iteration count
                if "iteration_count" not in state:
                    state["iteration_count"] = {}
                state["iteration_count"]["generate_video"] = state["iteration_count"].get("generate_video", 0) + 1
                return state
        
        # Fallback if HeyGen failed or skipped
        print("⚠️ HeyGen generation failed or skipped. Using mock video.")
        import uuid
        video_id = f"mock_video_{uuid.uuid4()}"
        state["video_id"] = video_id
        state["video_status"] = "completed"
        # Return a fallback video
        state["video_url"] = "https://cdn.pixabay.com/video/2022/11/20/140027-773738049_large.mp4" 
        
        # Update iteration count
        if "iteration_count" not in state:
            state["iteration_count"] = {}
        state["iteration_count"]["generate_video"] = state["iteration_count"].get("generate_video", 0) + 1
        return state
    
    async def _facebook_auth_node(self, state: WorkflowState) -> WorkflowState:
        """Authenticate with Facebook"""
        state["current_step"] = "facebook_auth"
        
        # Check if we have a token in messages
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                token = last_msg.get("content")
                # Basic validation - assume it's a token if it's long enough
                if len(token) > 50:
                    auth_result = await authenticate_user(token)
                    
                    if auth_result["success"]:
                        state["facebook_access_token"] = token
                        state["facebook_user_id"] = auth_result["user_id"]
                        state["ad_accounts"] = auth_result["ad_accounts"]
                        
                        # Auto-select if only one account
                        if len(auth_result["ad_accounts"]) == 1:
                            state["selected_ad_account_id"] = auth_result["ad_accounts"][0]["id"]
                    else:
                        state["error"] = f"Authentication failed: {auth_result.get('error')}"
        
        return state

    def _select_ad_account_node(self, state: WorkflowState) -> WorkflowState:
        """Select Facebook Ad Account"""
        state["current_step"] = "select_ad_account"
        
        # Check for selection in messages
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                content = last_msg.get("content", "")
                content_lower = content.lower()
                
                # Check for explicit SWITCH intent
                if "switch" in content_lower or "change" in content_lower or "different" in content_lower:
                    print("DEBUG: Clearing selected ad account for switch")
                    state["selected_ad_account_id"] = None
                    return state
                
                
                # Check for "Select account X" pattern or just an ID
                import re
                # Look for numeric ID (usually 15+ digits for FB)
                match = re.search(r'(?:account\s+)?(\d{10,})', content)
                if match:
                    account_id = match.group(1)
                    # Verify it's in the list
                    ad_accounts = state.get("ad_accounts", [])
                    for acc in ad_accounts:
                        if acc.get("id") == account_id or acc.get("account_id") == account_id:
                            state["selected_ad_account_id"] = acc.get("id")
                            break
        
        account_id = state.get("selected_ad_account_id")
        if not account_id:
            state["error"] = "No ad account selected"
            
        return state

    def _select_media_node(self, state: WorkflowState) -> WorkflowState:
        """Select media for the ad"""
        state["current_step"] = "select_media"
        
        # Check for selection in messages
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                content = last_msg.get("content", "")
                # Check for "Select media X"
                if "select media" in content.lower():
                    url = content.split("media")[-1].strip()
                    if url:
                        # Determine type
                        media_type = "video" if url.endswith(".mp4") else "image"
                        state["selected_media"] = {
                            "type": media_type,
                            "url": url,
                            "filename": os.path.basename(url)
                        }

        # If no media selected, try to auto-select the generated video
        if not state.get("selected_media"):
            video_url = state.get("video_url")
            if video_url:
                # Find the video in media manager to get full metadata
                # For now, construct basic metadata
                state["selected_media"] = {
                    "type": "video",
                    "url": video_url,
                    "filename": os.path.basename(video_url)
                }
        
        return state

    async def _generate_campaign_preview_node(self, state: WorkflowState) -> WorkflowState:
        """Generate campaign configuration and preview"""
        state["current_step"] = "preview_campaign"
        
        selected_media = state.get("selected_media")
        if not selected_media:
            state["error"] = "No media selected"
            return state
            
        # Generate config if not exists
        if not state.get("campaign_config"):
            # Gather context
            context = f"""
            Product: {state.get('selected_product', {}).get('title', 'Unknown Product')}
            Analysis: {state.get('analysis', {}).get('summary', '')}
            Script: {state.get('selected_script', '')}
            """
            
            config = await self.campaign_creation_agent.create_campaign(selected_media, context)
            state["campaign_config"] = config
            
        # Generate preview text
        preview = await self.campaign_preview_agent.generate_preview(
            state["campaign_config"],
            selected_media
        )
        state["campaign_preview"] = preview["preview_text"]
        
        return state

    async def _refine_campaign_node(self, state: WorkflowState) -> WorkflowState:
        """Refine campaign configuration based on feedback"""
        state["current_step"] = "refine_campaign"
        
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1]
            if last_msg.get("role") == "user" and last_msg.get("content"):
                feedback = last_msg.get("content")
                
                current_config = state.get("campaign_config")
                if current_config:
                    new_config = await self.campaign_modification_agent.modify_campaign(
                        current_config,
                        feedback
                    )
                    state["campaign_config"] = new_config
                    
                    # Regenerate preview
                    preview = await self.campaign_preview_agent.generate_preview(
                        new_config,
                        state.get("selected_media")
                    )
                    state["campaign_preview"] = preview["preview_text"]
        
        return state

    async def _publish_campaign_node(self, state: WorkflowState) -> WorkflowState:
        """Publish campaign to Facebook"""
        state["current_step"] = "publish_campaign"
        
        if state.get("publish_status") == "success":
            return state
            
        try:
            config = state.get("campaign_config")
            access_token = state.get("facebook_access_token")
            account_id = state.get("selected_ad_account_id")
            media = state.get("selected_media")
            
            if not all([config, access_token, account_id, media]):
                state["error"] = "Missing required information for publishing"
                return state
                
            # 1. Upload Media
            media_type = media.get("type", "image")
            # Construct local file path from URL
            # URL is like /static/videos/filename.mp4 -> static/videos/filename.mp4
            file_path = media.get("url", "").lstrip("/")
            if not os.path.exists(file_path):
                # Try adding static/ if missing
                if os.path.exists(f"static/{file_path}"):
                    file_path = f"static/{file_path}"
                else:
                    state["error"] = f"Media file not found: {file_path}"
                    return state
            
            media_hash = None
            video_id = None
            
            if media_type == "video":
                upload_res = await self.media_manager.upload_video_to_facebook(
                    file_path, access_token, account_id
                )
                if "error" in upload_res:
                    raise Exception(f"Video upload failed: {upload_res['error']}")
                video_id = upload_res["video_id"]
            else:
                upload_res = await self.media_manager.upload_image_to_facebook(
                    file_path, access_token, account_id
                )
                if "error" in upload_res:
                    raise Exception(f"Image upload failed: {upload_res['error']}")
                media_hash = upload_res["hash"]

            # 2. Create Campaign
            campaign_res = await create_campaign(
                account_id,
                config["campaign"]["name"],
                config["campaign"]["objective"],
                access_token,
                config["campaign"].get("special_ad_categories")
            )
            campaign_id = campaign_res["id"]
            
            # 3. Create Ad Set
            adset_res = await create_adset(
                account_id,
                campaign_id,
                config["adset"]["name"],
                config["adset"]["daily_budget"],
                "2025-12-01T12:00:00-0700", # TODO: Dynamic start time
                "2025-12-30T12:00:00-0700", # TODO: Dynamic end time
                access_token,
                config["adset"]["targeting"]
            )
            adset_id = adset_res["id"]
            
            # 4. Create Ad
            if media_type == "video":
                # Need page_id for video ads usually, or it uses the one associated with ad account
                # For now, we'll try to fetch page_id or assume one exists
                # In a real app, we'd select a Page first.
                # Let's try to get the first page the user has access to
                # For now, we'll assume the user has a page and we can find it or the API might error
                # We'll use a placeholder page_id if we can't find one, which will fail
                # Ideally we add a "Select Page" step.
                # For this demo, we'll skip page selection and try to use a dummy page_id or the user's ID
                # This might fail if not a Page ID.
                page_id = state.get("facebook_user_id") # Fallback
                
                await create_video_ad(
                    account_id,
                    adset_id,
                    page_id, 
                    config["ad"]["name"],
                    video_id,
                    None, # thumbnail_hash
                    config["ad"]["primary_text"],
                    config["ad"]["link"],
                    access_token
                )
            else:
                page_id = state.get("facebook_user_id") # Fallback
                
                await create_image_ad(
                    account_id,
                    adset_id,
                    page_id,
                    config["ad"]["name"],
                    media_hash,
                    config["ad"]["primary_text"],
                    config["ad"]["link"],
                    access_token
                )
            
            state["publish_status"] = "success"
            state["final_campaign_id"] = campaign_id
            
        except Exception as e:
            state["error"] = f"Publishing failed: {str(e)}"
            state["publish_status"] = "failed"
            
        return state

    async def run_step(self, state: WorkflowState, config: Dict = None) -> WorkflowState:
        """Execute one step of the workflow"""
        if config is None:
            config = {"configurable": {"thread_id": "default"}}
        
        # Run the graph
        result = await self.app.ainvoke(state, config)
        return result
    
    def update_state(self, config: Dict, values: Dict):
        """Proxy to update the state of the compiled graph"""
        return self.app.update_state(config, values)
    
    def get_state(self, thread_id: str = "default") -> WorkflowState:
        """Get current state for a thread"""
        config = {"configurable": {"thread_id": thread_id}}
        # Get the latest state from memory
        # This is a simplified version - in production you'd use get_state_stream
        # For now, return empty state - server maintains state
        return {
            "current_step": "scrape",
            "navigation_intent": None,
            "messages": [],
            "url": None,
            "product_data": None,
            "selected_product": None,
            "analysis": None,
            "analysis_feedback": [],
            "scripts": None,
            "script_feedback": [],
            "selected_script_index": None,
            "selected_script": None,
            "script_refinement_feedback": [],
            "generated_images": None,
            "image_feedback": [],
            "image_generation_prompt": None,
            "audio_file": None,
            "audio_url": None,
            "available_avatars": None,
            "selected_avatar_id": None,
            "video_id": None,
            "video_url": None,
            "video_status": None,
            "error": None,
            "iteration_count": {},
            "facebook_access_token": None,
            "facebook_user_id": None,
            "ad_accounts": None,
            "selected_ad_account_id": None,
            "selected_media": None,
            "campaign_config": None,
            "campaign_preview": None,
            "publish_status": None
        }

