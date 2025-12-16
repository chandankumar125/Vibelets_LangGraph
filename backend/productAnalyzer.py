from dotenv import load_dotenv
import os
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json
import re
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_classic.memory import ConversationBufferMemory
import time
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
load_dotenv()
from config import Config

class ProductAnalyzer:
    """Analyzes product data using LangChain and OpenAI with interactive feedback"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=Config.OPENAI_API_KEY
        )
        self.analysis_memory = []
        self.script_memory = []
    
    def _parse_scripts(self, text: str) -> List[str]:
        """Parse scripts from LLM output using regex"""
        # Pattern to match SCRIPT [N]: or SCRIPT N: followed by content
        # We look for "SCRIPT" followed by optional brackets/numbers/colon
        # Then capture everything until the next "SCRIPT" or end of string
        pattern = r'SCRIPT\s*(?:\[?\d+\]?)?:?(.*?)(?=SCRIPT\s*(?:\[?\d+\]?)?:?|$)'
        
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        
        # Clean up matches
        scripts = []
        for match in matches:
            cleaned = match.strip()
            # Remove trailing dashes if present
            cleaned = re.sub(r'-+$', '', cleaned).strip()
            if cleaned:
                scripts.append(cleaned)
                
        # Fallback if no scripts found (maybe LLM didn't use SCRIPT label)
        if not scripts:
            # If the text contains "---", try splitting by that
            if '---' in text:
                parts = text.split('---')
                scripts = [p.strip() for p in parts if p.strip()]
            else:
                scripts = [text.strip()]
                
        return scripts

    def analyze_product_interactive(self, product_data: Dict) -> Dict:
        """
        Interactive product analysis with user feedback loop
        Continues until user types 'confirm'
        """
        print("\n" + "="*60)
        print("🔬 INTERACTIVE PRODUCT ANALYSIS")
        print("="*60)
        print("💡 Review the analysis and provide feedback.")
        print("   Type 'confirm' when satisfied, or provide refinement requests.")
        print("="*60 + "\n")
        
        # Initial analysis
        analysis = self._generate_analysis(product_data, [])
        self._display_analysis(analysis)
        
        # Feedback loop
        iteration = 1
        while True:
            user_input = input(f"\n[Iteration {iteration}] Your feedback (or 'confirm' to proceed): ").strip()
            
            if user_input.lower() == 'confirm':
                print("\n✅ Analysis confirmed!")
                return analysis
            
            if not user_input:
                print("⚠️  Please provide feedback or type 'confirm'")
                continue
            
            # Store user feedback in memory
            self.analysis_memory.append({
                "role": "user",
                "content": user_input
            })
            
            # Refine analysis based on feedback
            print(f"\n🔄 Refining analysis based on your feedback...")
            analysis = self._refine_analysis(product_data, user_input, analysis)
            self._display_analysis(analysis)
            
            iteration += 1
    
    def _generate_analysis(self, product_data: Dict, conversation_history: List) -> Dict:
        """Generate initial product analysis"""
        
        analysis_prompt = ChatPromptTemplate.from_messages([
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
        
        chain = analysis_prompt | self.llm | StrOutputParser()
        
        result = chain.invoke({
            "title": product_data.get('title', ''),
            "description": product_data.get('description', ''),
            "price": product_data.get('price', ''),
            "raw_text": product_data.get('raw_text', '')
        })
        
        try:
            return json.loads(result)
        except:
            return {"analysis": result}
    
    def _refine_analysis(self, product_data: Dict, user_feedback: str, current_analysis: Dict) -> Dict:
        """Refine analysis based on user feedback"""
        
        refinement_prompt = ChatPromptTemplate.from_messages([
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
        
        chain = refinement_prompt | self.llm | StrOutputParser()
        
        result = chain.invoke({
            "current_analysis": json.dumps(current_analysis, indent=2),
            "title": product_data.get('title', ''),
            "description": product_data.get('description', ''),
            "price": product_data.get('price', ''),
            "feedback": user_feedback
        })
        
        try:
            refined = json.loads(result)
            # Store in memory
            self.analysis_memory.append({
                "role": "assistant",
                "content": json.dumps(refined, indent=2)
            })
            return refined
        except:
            return current_analysis
    
    def _display_analysis(self, analysis: Dict):
        """Display analysis in a readable format"""
        print("\n" + "-"*60)
        print("📊 CURRENT ANALYSIS:")
        print("-"*60)
        for key, value in analysis.items():
            print(f"\n🔹 {key.upper().replace('_', ' ')}:")
            if isinstance(value, (list, dict)):
                print(f"   {json.dumps(value, indent=3)}")
            else:
                print(f"   {value}")
        print("-"*60)
    
    def generate_ad_scripts_interactive(self, product_data: Dict, analysis: Dict) -> List[str]:
        """
        Interactive script generation with user feedback loop
        Continues until user types 'confirm'
        """
        print("\n" + "="*60)
        print("✍️  INTERACTIVE AD SCRIPT GENERATION")
        print("="*60)
        print("💡 Review the scripts and provide feedback.")
        print("   Type 'confirm' when satisfied, or request modifications.")
        print("="*60 + "\n")
        
        # Initial script generation
        scripts = self._generate_scripts(product_data, analysis, [])
        self._display_scripts(scripts)
        
        # Feedback loop
        iteration = 1
        while True:
            user_input = input(f"\n[Iteration {iteration}] Your feedback (or 'confirm' to proceed): ").strip()
            
            if user_input.lower() == 'confirm':
                print("\n✅ Scripts confirmed!")
                return scripts
            
            if not user_input:
                print("⚠️  Please provide feedback or type 'confirm'")
                continue
            
            # Store user feedback in memory
            self.script_memory.append({
                "role": "user",
                "content": user_input
            })
            
            # Refine scripts based on feedback
            print(f"\n🔄 Refining scripts based on your feedback...")
            scripts = self._refine_scripts(product_data, analysis, user_input, scripts)
            self._display_scripts(scripts)
            
            iteration += 1
    
    def _generate_scripts(self, product_data: Dict, analysis: Dict, conversation_history: List) -> List[str]:
        """Generate initial ad scripts"""
        
        script_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a creative copywriter specializing in short-form video ad scripts for social media."),
            ("human", """
Create 3 unique short-form video ad scripts (30-45 seconds each) for this product:

Product: {title}
Target Audience: {target_audience}
USPs: {usps}
Marketing Angles: {marketing_angles}

Each script should:
- Hook viewers in the first 3 seconds
- Address a pain point or desire
- Highlight key benefits
- Include a clear call-to-action
- Be conversational and engaging
- Use AIDA framework (Attention, Interest, Desire, Action)

Format each script with:
SCRIPT [1/2/3]:
[Script content - spoken word only, 30-45 seconds when read aloud, around 100 words max.]
---

Make each script distinctly different in approach (problem-solution, testimonial-style, lifestyle-focused).
Output only the voice over without additional commentary.
""")
        ])
        
        chain = script_prompt | self.llm | StrOutputParser()
        
        result = chain.invoke({
            "title": product_data.get('title', ''),
            "target_audience": str(analysis.get('target_audience', '')),
            "usps": str(analysis.get('usps', '')),
            "marketing_angles": str(analysis.get('marketing_angles', ''))
        })
        
        # Parse the scripts
        scripts = self._parse_scripts(result)
        
        return scripts
    
    def _refine_scripts(self, product_data: Dict, analysis: Dict, user_feedback: str, current_scripts: List[str]) -> List[str]:
        """Refine scripts based on user feedback"""
        
        refinement_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a creative copywriter. Refine the ad scripts based on user feedback while maintaining quality and effectiveness."),
            ("human", """
Current Scripts:
{current_scripts}

Product: {title}
Target Audience: {target_audience}
USPs: {usps}

User Feedback: {feedback}

Refine the 3 scripts addressing the user's feedback. Maintain the format:
SCRIPT [1/2/3]:
[Script content]
---

Keep scripts 30-45 seconds when read aloud (around 100 words max each).
""")
        ])
        
        chain = refinement_prompt | self.llm | StrOutputParser()
        
        # Format current scripts for display
        scripts_text = ""
        for i, script in enumerate(current_scripts, 1):
            scripts_text += f"\nSCRIPT {i}:\n{script}\n---\n"
        
        result = chain.invoke({
            "current_scripts": scripts_text,
            "title": product_data.get('title', ''),
            "target_audience": str(analysis.get('target_audience', '')),
            "usps": str(analysis.get('usps', '')),
            "feedback": user_feedback
        })
        
        # Parse the refined scripts
        scripts = self._parse_scripts(result)
        
        # Store in memory
        self.script_memory.append({
            "role": "assistant",
            "content": result
        })
        
        return scripts
    
    def _display_scripts(self, scripts: List[str]):
        """Display scripts in a readable format"""
        print("\n" + "-"*60)
        print("📝 CURRENT SCRIPTS:")
        print("-"*60)
        for i, script in enumerate(scripts, 1):
            print(f"\n🎬 SCRIPT {i}:")
            print(f"{script}")
            print("\n" + "-"*60)
    
    def refine_selected_script_interactive(self, selected_script: str, script_number: int) -> str:
        """
        Interactive refinement of a selected script
        Allows user to tweak the chosen script until confirmed
        """
        print("\n" + "="*60)
        print(f"🎨 REFINE SCRIPT {script_number}")
        print("="*60)
        print("💡 Provide tweaks or modifications to this script.")
        print("   Type 'confirm' when satisfied.")
        print("="*60 + "\n")
        
        current_script = selected_script
        print(f"\n🎬 CURRENT SCRIPT:")
        print(f"{current_script}")
        
        iteration = 1
        while True:
            user_input = input(f"\n[Tweak {iteration}] Your modifications (or 'confirm' to finalize): ").strip()
            
            if user_input.lower() == 'confirm':
                print("\n✅ Script finalized!")
                return current_script
            
            if not user_input:
                print("⚠️  Please provide modifications or type 'confirm'")
                continue
            
            # Refine the specific script
            print(f"\n🔄 Applying your modifications...")
            current_script = self._tweak_script(current_script, user_input)
            
            print(f"\n🎬 UPDATED SCRIPT:")
            print(f"{current_script}")
            
            iteration += 1
    
    def _tweak_script(self, current_script: str, user_feedback: str) -> str:
        """Apply specific tweaks to a script"""
        
        tweak_prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a creative copywriter. Modify the script based on specific user requests while maintaining effectiveness."),
            ("human", """
Current Script:
{current_script}

User Request: {feedback}

Provide the modified script (30-45 seconds when read aloud). Output only the script content without labels or commentary.
""")
        ])
        
        chain = tweak_prompt | self.llm | StrOutputParser()
        
        result = chain.invoke({
            "current_script": current_script,
            "feedback": user_feedback
        })
        
        return result.strip()