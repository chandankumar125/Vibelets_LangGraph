"""
LangChain agents for each step of the workflow
Each agent is specialized for its task and supports chat-based refinement
"""
from typing import Dict, List, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage, AIMessage
import json
import re
from config import Config

class AnalysisAgent:
    """Agent for product analysis with chat-based refinement"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    async def analyze(self, product_data: Dict, feedback_history: List[str] = None) -> Dict:
        """Generate or refine product analysis"""
        feedback_history = feedback_history or []
        
        if not feedback_history:
            # Initial analysis
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are an expert marketing analyst specializing in product analysis and target audience identification."),
                ("human", """
Analyze this product and provide a detailed analysis:

Product Name: {title}
Description: {description}
Price: {price}
Additional Context: {raw_text}

Provide:
1. Product Category and Key Features
2. Target Audience (demographics, psychographics, pain points)
3. Unique Selling Propositions (USPs)
4. Marketing Angles and Emotional Triggers
5. Competitive Positioning

Format as JSON with keys: category, features, target_audience, usps, marketing_angles, positioning
""")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "title": product_data.get('title', '')[:200],
                "description": product_data.get('description', '')[:1000],
                "price": product_data.get('price', '')[:20],
                "raw_text": product_data.get('raw_text', '')[:3000]
            })
        else:
            # Refinement based on feedback
            latest_feedback = feedback_history[-1]
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are an expert marketing analyst. Refine the product analysis based on user feedback while maintaining accuracy."),
                ("human", """
Current Analysis:
{current_analysis}

Product Context:
Product Name: {title}
Description: {description}
Price: {price}

User Feedback: {feedback}

Refine the analysis addressing the user's feedback. Maintain the JSON format with keys: category, features, target_audience, usps, marketing_angles, positioning
""")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "current_analysis": json.dumps(product_data.get('current_analysis', {}), indent=2),
                "title": product_data.get('title', ''),
                "description": product_data.get('description', ''),
                "price": product_data.get('price', ''),
                "feedback": latest_feedback
            })
        
        try:
            # 1. Try to extract JSON between markdown blocks
            json_match = re.search(r'```json\s*(.*?)\s*```', result, re.DOTALL)
            if json_match:
                result = json_match.group(1)
            else:
                # Try just ``` blocks
                json_match = re.search(r'```\s*(.*?)\s*```', result, re.DOTALL)
                if json_match:
                    result = json_match.group(1)
            
            # 2. Basic cleanup
            cleaned = result.strip()
            # Remove any non-JSON characters if they somehow remained at start/end
            cleaned = re.sub(r'^[^{]*', '', cleaned)
            cleaned = re.sub(r'[^}]*$', '', cleaned)
            
            data = json.loads(cleaned)
            
            # 3. Handle nesting if AI wrapped it
            if isinstance(data, dict):
                if list(data.keys()) == ["analysis"] and isinstance(data["analysis"], (dict, str)):
                    inner = data["analysis"]
                    if isinstance(inner, str):
                        try:
                            # Recursive check for stringified JSON inside
                            inner_cleaned = re.sub(r'```json\s*|\s*```', '', inner).strip()
                            return json.loads(inner_cleaned)
                        except:
                            pass
                    return inner
            return data
        except Exception as e:
            print(f"JSON parsing error in AnalysisAgent: {e}")
            return {"analysis_raw": result}


class ScriptGenerationAgent:
    """Agent for generating ad scripts with chat-based refinement"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.8,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    def _parse_scripts(self, text: str) -> List[str]:
        """Parse scripts from LLM output using robust regex"""
        scripts = []
        
        # Pattern to match "### SCRIPT [N] ###" or similar headers and capture content until next header or end
        # This handles variations like "### SCRIPT 1 ###", "### SCRIPT [1]", "Script 1:", etc.
        pattern = r'(?:###\s*SCRIPT\s*(?:\[?\d+\]?)?\s*###|SCRIPT\s*(?:\[?\d+\]?)?:?)(.*?)(?=(?:###\s*SCRIPT|SCRIPT\s*(?:\[?\d+\]?)?:?)|$)'
        
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        
        for match in matches:
            cleaned = match.strip()
            # Remove potential leading numbering like "1." or "[1]" if not caught by main pattern
            cleaned = re.sub(r'^\s*(?:\[?\d+\]?\.?|:)\s*', '', cleaned)
            # Remove trailing delimiters
            cleaned = re.sub(r'-+$', '', cleaned).strip()
            
            if cleaned and len(cleaned) > 20:  # Minimal length check
                scripts.append(cleaned)
        
        # Fallback: if no scripts found, try splitting by double newlines if it looks like a list
        if not scripts:
            print("Regex parsing failed, falling back to simple split")
            parts = text.split("\n\n")
            for part in parts:
                if len(part.strip()) > 50:
                    scripts.append(part.strip())

        return scripts[:3]  # Ensure max 3 scripts
    
    async def generate_scripts(self, product_data: Dict, analysis: Dict, feedback_history: List[str] = None, target_duration: str = "8-10 seconds") -> List[str]:
        """Generate or refine ad scripts"""
        feedback_history = feedback_history or []
        
        # Check if feedback specifies duration
        if feedback_history:
            last_feedback = feedback_history[-1].lower()
            if "10" in last_feedback and ("sec" in last_feedback or "second" in last_feedback):
                target_duration = "10 seconds"
        
        if not feedback_history:
            # Initial generation
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a creative copywriter specializing in short-form video ad scripts for social media (TikTok, Reels, Shorts)."),
                ("human", """
Create exactly 3 unique short-form video ad scripts (exactly {duration} each) for this product:

Product: {title}
Target Audience: {target_audience}
USPs: {usps}
Marketing Angles: {marketing_angles}

CRITICAL INSTRUCTIONS:
- You MUST tailor the scripts specifically to the defined Target Audience.
- You MUST highlight the provided USPs.
- You MUST utilize the suggested Marketing Angles.
- Do not generate generic scripts; use the specific product analysis provided above.

You must generate exactly these 3 styles:
1. Fast-Paced / Hype (Quick cuts, high energy, exciting)
2. Problem-Solution (Identify pain point -> Show product as hero)
3. Storytelling (Narrative arc, relatable scenario)

Each script should:
- Be FULL scripts with dialogue and visual descriptions.
- Include visual cues in parentheses (e.g., [Close up of texture], [Text overlay: ...])
- Have a strong hook in the first 2 seconds
- End with a clear Call to Action (CTA)

IMPORTANT: Format each script CLEARLY using the following delimiters:

### SCRIPT [1] ###
[Script content here...]

### SCRIPT [2] ###
[Script content here...]

### SCRIPT [3] ###
[Script content here...]

Do not include any intro or outro text. Just the 3 scripts.
""")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "title": product_data.get('title', ''),
                "target_audience": str(analysis.get('target_audience', '')),
                "usps": str(analysis.get('usps', '')),
                "marketing_angles": str(analysis.get('marketing_angles', '')),
                "duration": target_duration
            })
        else:
            # Refinement
            latest_feedback = feedback_history[-1]
            scripts_text = ""
            for i, script in enumerate(product_data.get('current_scripts', []), 1):
                scripts_text += f"\n### SCRIPT [{i}] ###\n{script}\n"
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a creative copywriter. Refine the ad scripts based on user feedback while maintaining quality and effectiveness."),
                ("human", """
Current Scripts:
{current_scripts}

Product: {title}
Target Audience: {target_audience}
USPs: {usps}
Target Duration: {duration}

User Feedback: "{feedback}"

Refine the 3 scripts addressing the user's feedback. 
IMPORTANT: Return exactly 3 scripts using the SAME format:

### SCRIPT [1] ###
[Refined content for script 1]

### SCRIPT [2] ###
[Refined content for script 2]

### SCRIPT [3] ###
[Refined content for script 3]
""")
            ])
            
            chain = prompt | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "current_scripts": scripts_text,
                "title": product_data.get('title', ''),
                "target_audience": str(analysis.get('target_audience', '')),
                "usps": str(analysis.get('usps', '')),
                "feedback": latest_feedback,
                "duration": target_duration
            })
        
        return self._parse_scripts(result)
    
    async def refine_script(self, script: str, feedback: str) -> str:
        """Refine a single selected script"""
        target_duration = "8-10 seconds"
        if "10" in feedback.lower() and ("sec" in feedback.lower() or "second" in feedback.lower()):
            target_duration = "10 seconds"

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a creative copywriter. Modify the script based on specific user requests while maintaining effectiveness."),
            ("human", """
Current Script:
{current_script}

User Request: {feedback}

Provide the modified script ({duration} when read aloud). Output only the script content without labels or commentary.
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "current_script": script,
            "feedback": feedback,
            "duration": target_duration
        })
        
        return result.strip()


class ImageGenerationAgent:
    """Agent for generating images with chat-based refinement"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
        # We'll still use the ImageGenerator for actual generation
        from image_generation import ImageGenerator
        self.image_gen = ImageGenerator()
    
    async def generate_prompt(self, product_data: Dict, script: str, analysis: Dict = None, feedback: str = None) -> str:
        """Generate or refine image generation prompt using LLM"""
        
        if feedback:
            # Refine prompt based on feedback
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", "You are an expert in creating detailed image generation prompts for commercial advertisements."),
                ("human", """
Current Image Generation Prompt:
{current_prompt}

Product Context:
- Product: {title}
- Description: {description}
- Script Context: {script_context}

User Feedback: {feedback}

Create a refined, detailed image generation prompt that addresses the user's feedback. 
The prompt should describe a professional commercial advertisement static featuring the product.
Include details about setting, style, composition, lighting, and mood.
Keep it focused on the product as the focal point.
""")
            ])
            
            chain = prompt_template | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "current_prompt": product_data.get('current_prompt', ''),
                "title": product_data.get('title', ''),
                "description": product_data.get('description', ''),
                "script_context": script[:200],
                "feedback": feedback
            })
            return result.strip()
        else:
            # Initial prompt generation
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", "You are an expert in creating detailed image generation prompts for commercial advertisements."),
                ("human", """
Create a detailed image generation prompt for a commercial advertisement featuring this product:

Product: {title}
Description: {description}
Script Context: {script_context}
Target Audience: {target_audience}
Marketing Angle: {marketing_angle}

The prompt should describe:
- A professional commercial advertisement static
- High-quality, aesthetic setting suitable for marketing
- Product as the focal point
- Modern, premium, commercial photography style
- Appropriate mood and lighting based on the marketing angle

Output only the prompt, no additional commentary.
""")
            ])
            
            chain = prompt_template | self.llm | StrOutputParser()
            result = await chain.ainvoke({
                "title": product_data.get('title', ''),
                "description": product_data.get('description', ''),
                "script_context": script[:200],
                "target_audience": str(analysis.get('target_audience', '')) if analysis else '',
                "marketing_angle": str(analysis.get('marketing_angles', '')) if analysis else ''
            })
            return result.strip()
    
    def generate_images(self, product_url: str, image_prompt: str, num_images: int = 2, base_image: Any = None) -> List[str]:
        """Generate images using the refined prompt"""
        return self.image_gen.generate_ad_creatives_with_prompt(
            product_url, 
            image_prompt, 
            num_images,
            base_image=base_image
        )


class NavigationAgent:
    """Agent for determining navigation intent from user messages"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    async def analyze_intent(self, state: Dict) -> Dict[str, Any]:
        """Analyze user message to determine navigation intent"""
        messages = state.get("messages", [])
        if not messages:
            return {"intent": "continue"}
            
        # Get the last user message
        last_user_message = None
        for msg in reversed(messages):
            if msg.get("role") == "user":
                last_user_message = msg.get("content")
                break
        
        if not last_user_message:
            return {"intent": "continue"}
            
        current_step = state.get("current_step", "scrape")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a navigation router for an ad campaign generation workflow.
Your job is to determine where the user wants to go based on their message and the current step.

Workflow Steps (Internal Names):
1. "scrape" (Input Product Link / product-url)
2. "analyze" (AI Analysis of Product / product-analysis)
3. "generate_scripts" (Generation scripts / script-selection)
4. "select_script" (Choosing a script / script-selection)
5. "generate_images" (Generate Visuals / creative-generation)
6. "select_avatar" (Choose Presenter / avatar-selection)
7. "generate_video" (Assembling final video / creative-generation)
8. "facebook_auth" (Connect Facebook / facebook-integration)
9. "select_ad_account" (Select Ad Account / ad-account-selection)
10. "select_page" (Select Facebook Page / page-selection)
11. "preview_campaign" (Review & Launch / campaign-preview)

Rules:
- If user says "next", "looks good", "continue", or approves current output -> return "next"
- If user says "back", "go back", "previous", "return" -> return "back"

- If user provides a URL (starts with http/https/www) -> return "scrape"
- If user wants to CHANGE/RESET/NEW URL (e.g., "change url", "new url", "different product", "start over") -> return "change_url"
- If user wants to change something from a previous step (e.g., "change target audience") -> return the name of that step (e.g., "analyze")
- If user explicitly asks to go to a step (e.g., "go to facebook", "connect facebook") -> return that internal step name (e.g., "facebook_auth")
- If user provides feedback for scripts (e.g., "make it shorter", "change tone", "10 sec script") -> return "generate_scripts"
- If user provides feedback for images (e.g., "make it darker", "add a dog") -> return "generate_images"
- If user provides feedback for the CURRENT step (e.g., "make it funnier" while in generate_scripts) -> return "stay" (to refine)
- If user provides a number (1, 2, 3...) during a selection step -> return "select_script" (if in script-selection) or "select_avatar" (if in avatar-selection)
- If user wants to stop -> return "complete"

IMPORTANT: Choose from internal names: "scrape", "analyze", "generate_scripts", "select_script", "generate_images", "select_avatar", "generate_video", "facebook_auth", "select_ad_account", "select_page", "preview_campaign".

Output JSON:
{{
    "intent": "next" | "back" | "stay" | "complete" | "change_url" | "scrape" | "analyze" | "select_script" | "generate_images" | "select_avatar" | "facebook_auth" | "select_ad_account" | "select_page" | "preview_campaign",
    "reasoning": "brief explanation"
}}
"""),
            ("human", """
Current Step: {current_step}
User Message: {user_message}

Determine the navigation intent.
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "current_step": current_step,
            "user_message": last_user_message
        })
        
        try:
            # Clean up potential markdown code blocks
            cleaned_result = result.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned_result)
        except:
            print(f"Failed to parse navigation intent: {result}")
            return {"intent": "stay"}


class GuideAgent:
    """Agent for providing friendly guidance and next steps"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    async def generate_guidance(self, state: Dict) -> str:
        """Generate friendly guidance based on current state"""
        current_step = state.get("current_step", "scrape")
        error = state.get("error")
        
        # Context building
        context = {
            "error": error,
            "has_url": bool(state.get("url")),
            "has_analysis": bool(state.get("analysis")),
            "has_scripts": bool(state.get("scripts")),
            "selected_script": bool(state.get("selected_script")),
            "has_images": bool(state.get("generated_images")),
            "has_audio": bool(state.get("audio_file")),
            "has_video": bool(state.get("video_url"))
        }
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a friendly, helpful AI guide for an ad campaign generation tool.
Your goal is to explain what just happened and guide the user on what to do next.
Be conversational, encouraging, and concise.
Use a natural, human-like tone.

Workflow Steps:
1. scrape: User inputs a product URL.
2. analyze: AI analyzes the product. User can refine.
3. generate_scripts: AI creates scripts. User can refine.
4. select_script: User picks one script.
5. refine_script: User edits the chosen script.
6. generate_images: AI creates images. User can refine.
7. refine_images: User edits image prompts.
8. generate_audio: AI generates voiceover.
9. select_avatar: User picks an avatar.
10. generate_video: AI creates the final video.

Current Step: {current_step}
Context: {context}

Instructions:
- If there is an error, explain it simply and ask them to try again.
- If a step just finished successfully, summarize it briefly (e.g., "I've analyzed your product!") and suggest the next logical step.
- If waiting for input, tell them exactly what to provide (e.g., "Please paste the product URL to get started.").
- Keep it short (max 2 sentences).
"""),
            ("human", "What should I tell the user now?")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "current_step": current_step,
            "context": str(context)
        })
        
        return result.strip()


