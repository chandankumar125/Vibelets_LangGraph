"""
AI Support Service - Intelligent responses with optional RAG
Falls back gracefully if RAG dependencies unavailable
"""
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import json
from config import Config

def get_support_service() -> 'SupportService': # Singleton access
    """Get support service instance"""
    global _support_service
    if _support_service is None:
        _support_service = SupportService()
    return _support_service

class SupportService:
    """Intelligent support service with optional RAG"""
    
    def __init__(self):
        """Initialize support service"""
        self.rag_available = False
        self.rag_service = None
        self._try_init_rag()
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            openai_api_key=Config.OPENAI_API_KEY
        )
    
    def _try_init_rag(self):
        """Try to initialize RAG, fall back gracefully if unavailable"""
        try:
            # Pre-import chromadb to ensure it's available
            import chromadb
            # print(f"✅ ChromaDB available: {chromadb.__version__}")
            
            import sys
            from pathlib import Path
            
            # Add ai-support to path
            ai_support_path = Path(__file__).parent / "ai-support_vibelets_langgraph"
            if str(ai_support_path) not in sys.path:
                sys.path.insert(0, str(ai_support_path))
            
            # Try to import RAG components
            from src.rag_services import RAGService
            from src.database import db_manager
            
            self.rag_service = RAGService()
            
            # Check if trained
            # stats = db_manager.get_collection_stats()
            # if stats.get("total_chunks", 0) > 0:
            self.rag_available = True
            #     print(f"✅ RAG system loaded")
            # else:
            #     print("⚠️  RAG database empty")
                
        except Exception as e:
            # RAG failed to load - use intelligent fallback
            # print(f"ℹ️  RAG unavailable (using intelligent fallback): {e}")
            self.rag_available = False
    
    async def is_navigation_query(self, message: str, current_step: str) -> Dict[str, Any]:
        """Classify navigation vs support using LLM"""
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a classification agent for an ad campaign workflow tool.
Your job is to classify the USER MESSAGE into one of two categories: 'navigation' or 'support'.

Definitions:
- 'navigation': The user is trying to perform an action within the workflow, control the workflow, provide inputs (URL, feedback, choices), or move between steps.
- 'support': The user is asking for help, asking specific "how to" questions, reporting errors, or asking general questions unrelated to performing the immediate task.

Workflow Context:
The user is currently at step: "{current_step}"

Examples:
- "next", "continue", "go back" -> navigation
- "use this url: ..." -> navigation
- "I want option 2" -> navigation
- "make the script funnier" -> navigation (refining inputs)
- "how do I connect facebook?" -> support
- "what does this error mean?" -> support
- "start over" -> navigation
- "change the target audience" -> navigation
- "why is the video not generating?" -> support

Output valid JSON only:
{{
    "is_navigation": boolean,
    "intent": "navigation" or "support",
    "confidence": float (0.0 to 1.0),
    "reasoning": "brief explanation"
}}
"""),
            ("human", "User Message: {message}")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        try:
            result_str = await chain.ainvoke({
                "current_step": current_step,
                "message": message
            })
            
            cleaned = result_str.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except Exception as e:
            print(f"LLM Classification failed: {e}")
            # Fallback to simple heuristic
            is_help = any(w in message.lower() for w in ['help', 'how to', 'what is', 'error', 'bug'])
            return {
                "is_navigation": not is_help,
                "intent": "support" if is_help else "navigation",
                "confidence": 0.5,
                "reasoning": "Fallback heuristic"
            }
    
    async def get_support_response(self, question: str, current_step: str = None, top_k: int = 5) -> Dict[str, Any]:
        """Get support response - RAG if available, intelligent fallback otherwise"""
        
        # Try RAG first if available
        if self.rag_available and self.rag_service:
            try:
                result = self.rag_service.answer_question(question=question, top_k=top_k)
                return {
                    "answer": result.get("answer", ""),
                    "confidence": result.get("confidence", 0.8),
                    "sources": result.get("sources", []),
                    "suggested_actions": []
                }
            except Exception as e:
                print(f"⚠️  RAG query failed, using fallback: {e}")
        
        # LLM Fallback (General Knowledge)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful support assistant for an Ad Campaign Generator tool. The user has a question."),
            ("human", "{question}")
        ])
        chain = prompt | self.llm | StrOutputParser()
        answer = await chain.ainvoke({"question": question})

        return {
            "answer": answer,
            "confidence": 0.7,
            "sources": [],
            "suggested_actions": []
        }

_support_service = None
