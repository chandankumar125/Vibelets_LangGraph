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

class ElevenLabsVoiceGenerator:
    """Handles text-to-speech generation using Eleven Labs API"""
    
    def __init__(self):
        self.api_key = "sk_13a64a9877a3d92e503ec078db070fb6fde8bdf8e40e67ef"
        if not self.api_key:
            print("WARNING: ELEVENLABS_API_KEY is not set in environment variables.")
        else:
            print(f"ELEVENLABS_API_KEY loaded: {self.api_key[:4]}...{self.api_key[-4:]}")
        self.voice_id = "raMcNf2S8wCmuaBcyI6E"
    
    def generate_voice(self, text: str, output_filename: str = "voiceover.mp3") -> str:
        """Generate voice from text and save to file"""
        
        url = f"{Config.ELEVENLABS_TTS_URL}/{self.voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        try:
            response = requests.post(url, json=data, headers=headers)
            response.raise_for_status()
            
            with open(output_filename, 'wb') as f:
                f.write(response.content)
            
            print(f"✓ Voice generated and saved to {output_filename}")
            return output_filename
        except Exception as e:
            print(f"✗ Error generating voice: {str(e)}")
            return None