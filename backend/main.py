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
from orchestrator import AdCampaignAgent
def main():
    """Entry point"""
    
    required_keys = {
        "OPENAI_API_KEY": Config.OPENAI_API_KEY,
        "ELEVENLABS_API_KEY": Config.ELEVENLABS_API_KEY,
        "HEYGEN_API_KEY": Config.HEYGEN_API_KEY
    }
    
    missing_keys = [k for k, v in required_keys.items() if not v]
    
    if missing_keys:
        print("⚠️  Warning: Missing API keys:")
        for key in missing_keys:
            print(f"  - {key}")
        print("\nSet them as environment variables before running.")
        
        proceed = input("\nContinue anyway? (y/n): ").strip().lower()
        if proceed != 'y':
            return
    
    agent = AdCampaignAgent()
    agent.run()

if __name__ == "__main__":
    main()