from dotenv import load_dotenv
import os
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json
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
from scraper import ProductScraper
from productAnalyzer import ProductAnalyzer
from audioGeneration import ElevenLabsVoiceGenerator
from heygen import HeyGenAvatarIntegrator

class AdCampaignAgent:
    """Main orchestrator for the ad campaign generation workflow"""
    
    def __init__(self):
        self.scraper = ProductScraper()
        self.analyzer = ProductAnalyzer()
        self.voice_gen = ElevenLabsVoiceGenerator()
        self.heygen = HeyGenAvatarIntegrator()
    
    def run(self):
        """Execute the full workflow with interactive feedback"""
        
        print("=" * 60)
        print("🎬 Interactive Product Ad Campaign Generator")
        print("=" * 60)
        
        # Step 1: Get URL from user
        url = input("\n📎 Enter the product or store URL: ").strip()
        
        if not url:
            print("❌ No URL provided. Exiting.")
            return
        
        print(f"\n🔍 Scraping data from: {url}")
        product_data = self.scraper.scrape_url(url)
        
        if "error" in product_data:
            print(f"❌ {product_data['error']}")
            return
        
        # Step 2: Handle store vs product selection
        selected_product = product_data
        
        if product_data.get("is_store") and product_data.get("products"):
            print(f"\n🏪 Store detected with {len(product_data['products'])} products:")
            for prod in product_data['products']:
                print(f"  {prod['id']}. {prod['name']}")
            
            choice = input("\n🔢 Select a product number (or press Enter to analyze the store): ").strip()
            
            if choice.isdigit() and 1 <= int(choice) <= len(product_data['products']):
                selected_product['title'] = product_data['products'][int(choice)-1]['name']
                print(f"\n✓ Selected: {selected_product['title']}")
        
        # Step 3: Interactive product analysis with feedback loop
        analysis = self.analyzer.analyze_product_interactive(selected_product)
        
        # Step 4: Interactive script generation with feedback loop
        scripts = self.analyzer.generate_ad_scripts_interactive(selected_product, analysis)
        
        # Step 5: Select script and allow interactive tweaking
        print("\n" + "="*60)
        print("🎯 SCRIPT SELECTION")
        print("="*60)
        
        script_choice = input("\n🎙️  Which script to use? (1-3, default=1): ").strip()
        script_idx = int(script_choice) - 1 if script_choice.isdigit() else 0
        script_idx = max(0, min(script_idx, len(scripts) - 1))
        
        selected_script = scripts[script_idx]
        
        # Step 6: Interactive tweaking of selected script
        final_script = self.analyzer.refine_selected_script_interactive(selected_script, script_idx + 1)
        
        # Step 7: Generate voice (only after confirmation)
        print(f"\n🎵 Generating voice for finalized script...")
        audio_file = self.voice_gen.generate_voice(final_script, f"script_{script_idx+1}_voice.mp3")
        
        if not audio_file:
            print("❌ Voice generation failed. Exiting.")
            return
        
        # Step 8: Integrate with HeyGen avatar
        print("\n🤖 Integrating with HeyGen avatar...")
        print("⚠️  Note: You need to upload the audio file to a public URL first.")
        
        audio_url = input("Enter the public URL of the audio file (or press Enter to skip): ").strip()
        
        if audio_url:
            avatar_result = self.heygen.create_avatar_video(audio_url)
            
            if "video_id" in avatar_result:
                # video_id = avatar_result["video_id"]
                video_id="35594a930c214102b20b2149b6c293f4"
                print(f"\n✓ Video generation started!")
                print(f"  Video ID: {video_id}")
                
                print("\n⏳ Checking video status...")
                time.sleep(5)
                status = self.heygen.check_video_status(video_id)
                print(f"  Status: {status.get('status', 'Unknown')}")
                
                if status.get('video_url'):
                    print(f"  Video URL: {status['video_url']}")
        else:
            print("ℹ️  Skipped HeyGen integration. Audio file saved locally.")
        
        print("\n" + "=" * 60)
        print("✅ Campaign generation complete!")
        print("=" * 60)
        
        # Save results
        results = {
            "product": selected_product.get('title'),
            "analysis": analysis,
            "all_scripts": scripts,
            "final_script": final_script,
            "audio_file": audio_file,
            "analysis_iterations": len(self.analyzer.analysis_memory),
            "script_iterations": len(self.analyzer.script_memory)
        }
        
        with open('campaign_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print("\n💾 Results saved to campaign_results.json")
        print(f"📊 Analysis iterations: {results['analysis_iterations']}")
        print(f"📝 Script iterations: {results['script_iterations']}")