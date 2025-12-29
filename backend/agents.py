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

IMPORTANT: If the current 'Price' is 'Price not found' or 'None', or if the 'SKU' is missing, search the 'Additional Context' (raw_text) carefully. If you find the actual price or SKU, include them in a 'corrections' key.

Format as JSON with keys: category, features, target_audience, usps, marketing_angles, positioning, corrections (optional: {{"price": "...", "sku": "...", "title": "..."}})
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
        
        print(f"\n📄 RAW LLM OUTPUT:\n{text}\n")
        
        # Pattern to match "### SCRIPT [N] ###" headers and capture content until next header or end
        # We look specifically for the triple hash prefix for the next script to avoid cutting off 
        # inside a script that might mention the word "script"
        pattern = r'###\s*SCRIPT\s*(?:\[?\d+\]?)?\s*###(.*?)(?=###\s*SCRIPT|$)'
        
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        print(f"🔍 Regex found {len(matches)} script blocks")
        
        for i, match in enumerate(matches):
            cleaned = match.strip()
            # Remove potential leading numbering like "1." or "[1]" if not caught by main pattern
            cleaned = re.sub(r'^\s*(?:\[?\d+\]?\.?|:)\s*', '', cleaned)
            # Remove trailing delimiters
            cleaned = re.sub(r'-+$', '', cleaned).strip()
            
            print(f"📝 Script {i+1} (length: {len(cleaned)}):\n{cleaned[:200]}...\n")
            
            if cleaned and len(cleaned) > 20:  # Minimal length check
                scripts.append(cleaned)
        
        # Fallback: if no scripts found, try splitting by double newlines if it looks like a list
        if not scripts:
            print("⚠️ Regex parsing failed, falling back to simple split")
            parts = text.split("\n\n")
            for part in parts:
                if len(part.strip()) > 50:
                    scripts.append(part.strip())

        print(f"✅ Final scripts count: {len(scripts)}")
        return scripts[:3]  # Ensure max 3 scripts
    
    async def generate_scripts(self, product_data: Dict, analysis: Dict, feedback_history: List[str] = None) -> List[str]:
        """Generate or refine ad scripts - generates 3 completely different scripts"""
        feedback_history = feedback_history or []
        
        if not feedback_history:
            # Generate 3 scripts separately to ensure they're completely different
            title = product_data.get('title', '')
            target_audience = str(analysis.get('target_audience', ''))
            usps = str(analysis.get('usps', ''))
            marketing_angles = str(analysis.get('marketing_angles', ''))
            
            scripts = []
            
            # SCRIPT 1: Fast-paced, punchy, shocking hook
            prompt1 = ChatPromptTemplate.from_messages([
                ("system", "You are a creative copywriter for viral short-form content."),
                ("human", """Create a SINGLE 15-30 second ad script for this product. Make it FAST, PUNCHY, with a SHOCKING HOOK.

Product: {title}
Target Audience: {target_audience}
USPs: {usps}

Requirements:
- Start with a shocking question or surprising fact (first 3 seconds)
- Use SHORT, SNAPPY sentences - max 5 words per sentence
- Create urgency and excitement
- Use exclamation marks liberally!
- End with a strong, immediate CTA
- Include [visual cues] for video
- Do NOT mention product benefits in a narrative way - just shock and awe
- Word count: 80-120 words

Format as:
### SCRIPT [1] ###
[Style: Fast-paced (15-30s)]
[Your script here]
""")
            ])
            
            chain1 = prompt1 | self.llm | StrOutputParser()
            result1 = await chain1.ainvoke({
                "title": title,
                "target_audience": target_audience,
                "usps": usps
            })
            scripts.append(result1)
            
            # SCRIPT 2: Problem/Solution, educational, sympathetic
            prompt2 = ChatPromptTemplate.from_messages([
                ("system", "You are a creative copywriter specializing in problem-solution narratives."),
                ("human", """Create a SINGLE 30-45 second ad script for this product. Make it EDUCATIONAL and RELATABLE with a PROBLEM-FIRST approach.

Product: {title}
Target Audience: {target_audience}
USPs: {usps}

Requirements:
- Start by describing a COMMON PAIN POINT your audience faces
- Show empathy and understanding
- Introduce the product as THE solution
- Use conversational, relatable tone
- Include [visual cues] showing the problem then the solution
- Tell a mini-story: Problem → Realization → Solution
- End with "Finally, there's a solution..." style CTA
- Word count: 120-160 words
- Use COMPLETELY DIFFERENT language than Script 1

Format as:
### SCRIPT [2] ###
[Style: Problem/Solution (30-45s)]
[Your script here]
""")
            ])
            
            chain2 = prompt2 | self.llm | StrOutputParser()
            result2 = await chain2.ainvoke({
                "title": title,
                "target_audience": target_audience,
                "usps": usps
            })
            scripts.append(result2)
            
            # SCRIPT 3: Storytelling, emotional, lifestyle-focused
            prompt3 = ChatPromptTemplate.from_messages([
                ("system", "You are a creative copywriter specializing in lifestyle and emotional storytelling for social media."),
                ("human", """Create a SINGLE 45-60 second ad script for this product. Make it an EMOTIONAL JOURNEY with LIFESTYLE FOCUS.

Product: {title}
Target Audience: {target_audience}
USPs: {usps}

Requirements:
- Open with ATMOSPHERIC scene-setting (paint a picture)
- Introduce a CHARACTER and their aspirations/lifestyle
- Show the product transforming their experience
- Use SENSORY DETAILS (how it feels, looks, sounds)
- Tell a complete story arc with emotional payoff
- Use warm, aspirational, intimate tone
- Include [visual cues] that paint scenes and moments
- End with lifestyle/aspirational CTA
- Word count: 150-200 words
- Use COMPLETELY DIFFERENT approach than Scripts 1 & 2 - no shock, no education, pure emotion

Format as:
### SCRIPT [3] ###
[Style: Storytelling (45-60s)]
[Your script here]
""")
            ])
            
            chain3 = prompt3 | self.llm | StrOutputParser()
            result3 = await chain3.ainvoke({
                "title": title,
                "target_audience": target_audience,
                "usps": usps
            })
            scripts.append(result3)
            
            # Combine all results
            result = "\n\n".join(scripts)
            
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

User Feedback: {feedback}

Refine the 3 scripts addressing the user's feedback. Keep them DIFFERENT from each other.
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
                "feedback": latest_feedback
            })
        
        scripts = self._parse_scripts(result)
        print(f"\n✅ FINAL SCRIPTS GENERATED: {len(scripts)} scripts")
        for i, script in enumerate(scripts, 1):
            print(f"\n📌 SCRIPT {i} SUMMARY:")
            print(f"   Length: {len(script)} chars")
            print(f"   First 100 chars: {script[:100]}...")
        return scripts
    
    async def refine_script(self, script: str, feedback: str) -> str:
        """Refine a single selected script"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a creative copywriter. Modify the script based on specific user requests while maintaining effectiveness."),
            ("human", """
Current Script:
{current_script}

User Request: {feedback}

Provide the modified script (aim for 30-45 seconds unless requested otherwise). Output only the script content without labels or commentary.
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "current_script": script,
            "feedback": feedback
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
    """Agent for determining navigation intent from user messages - NOW WITH SMART UNDERSTANDING"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    async def analyze_intent(self, state: Dict) -> Dict[str, Any]:
        """Analyze user message to determine navigation intent WITH SMART UNDERSTANDING"""
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
            ("system", """You are a SMART NAVIGATION ROUTER for an ad campaign generation workflow.
Your job is to understand WHAT THE USER WANTS and route them to the right place, even if they don't explicitly say step names.

Workflow Steps (5 Main Steps):
1. "product-url" - Paste product link and get variants/details
2. "product-analysis" - View AI analysis of product 
3. "script-selection" - Generate and choose ad scripts
4. "creative-generation" - Generate images, audio, video
5. "campaign-preview" - Review and publish campaign

SMART UNDERSTANDING RULES:
- If user provides a URL (http, https, www) -> scrape the product
- If user says "change url", "different product", "new url", "start over", "change product" -> go back to step 1
- If user says "next", "continue", "looks good", "approve", "okay" -> move to next step
- If user says "back", "previous", "go back", "change that" -> go to previous step
- If user asks about the product details/variants -> stay in product-analysis
- If user says "generate scripts", "create scripts", "write scripts" -> go to script-selection
- If user chooses a script (any reference like "script 1", "first one", "that one", "option 2") -> stay in script-selection
- If user gives feedback about scripts ("make funnier", "shorter", "slower", "change tone") -> refine_script
- If user says "next", "continue" from script-selection -> go to creative-generation
- If user wants images/audio/video features -> go to creative-generation
- If user gives feedback about images ("more colorful", "different style") -> refine_images
- If user says "ready", "publish", "launch", "done" -> go to campaign-preview
- If user wants to exit/stop -> return "complete"

Output JSON:
{{
    "intent": "next" | "back" | "stay" | "complete" | "scrape" | "refine_script" | "refine_images" | "step_name",
    "reasoning": "brief explanation of why"
}}
"""),
            ("human", """
Current Step: {current_step}
User Message: {user_message}

Understand what the user wants and determine navigation intent.
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
    """Agent for providing SMART guidance on what to type next"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    async def generate_guidance(self, state: Dict) -> str:
        """Generate guidance WITH HINTS on what user should type next"""
        current_step = state.get("current_step", "scrape")
        error = state.get("error")
        
        # Context building
        product_data = state.get("product_data", {})
        context = {
            "error": error,
            "has_url": bool(state.get("url")),
            "product_name": product_data.get("title") if product_data else None,
            "has_analysis": bool(state.get("analysis")),
            "has_scripts": bool(state.get("scripts")),
            "selected_script": bool(state.get("selected_script")),
            "has_images": bool(state.get("generated_images")),
        }
        
        guidance_prompts = {
            "product-url": """User should: Paste a product URL (from Amazon, Flipkart, etc)
Example: "https://www.amazon.com/...product-link..."
Or ask for help: "help me choose a product" """,
            
            "product-analysis": """User can:
- Say "next" to continue to scripts
- Ask questions about the product (e.g., "what's the target audience?")
- Ask to change something: "change target audience to..."
- Provide feedback: "I want to focus on..."
- Or paste a new URL to analyze a different product""",
            
            "script-selection": """User can:
- Say "script 1" or "choose the first one" to select a script
- Say "next" after selecting to move forward
- Ask to refine: "make it funnier" or "shorter"
- Say "back" to choose a different product
- Or paste a new URL to start fresh""",
            
            "creative-generation": """User can:
- Say "next" to continue
- Ask to regenerate images: "create different images"
- Ask about audio: "add voiceover"
- Ask about video: "create a reel" or "make it 9:16"
- Say "back" to change script
- Or start fresh: "new product" """,
            
            "campaign-preview": """User can:
- Say "publish" or "launch" to publish the campaign
- Say "back" to change something
- Ask for changes: "modify the..."
- Or say "done" when ready"""
        }
        
        step_guidance = guidance_prompts.get(current_step, "")
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a friendly AI assistant for an ad campaign creator.
Your goal is to:
1. Celebrate what was just completed
2. Explain the next step clearly
3. Give hints on what the user should type (specific examples help!)
4. Be encouraging and supportive

Keep it conversational, 2-3 sentences max. Include example commands they can type.
"""),
            ("human", """
Current Step: {current_step}
Context: {context}
What to suggest: {step_guidance}

Generate a friendly message with hints on what to type next.
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        result = await chain.ainvoke({
            "current_step": current_step,
            "context": str(context),
            "step_guidance": step_guidance
        })
        
        return result.strip()


