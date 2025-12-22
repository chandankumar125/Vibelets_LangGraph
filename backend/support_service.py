"""
AI Support Service - Intelligent responses with optional RAG
Falls back gracefully if RAG dependencies unavailable
"""
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

class SupportService:
    """Intelligent support service with optional RAG"""
    
    def __init__(self):
        """Initialize support service"""
        self.rag_available = False
        self.rag_service = None
        self._try_init_rag()
    
    def _try_init_rag(self):
        """Try to initialize RAG, fall back gracefully if unavailable"""
        try:
            # Pre-import chromadb to ensure it's available
            import chromadb
            print(f"✅ ChromaDB available: {chromadb.__version__}")
            
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
            stats = db_manager.get_collection_stats()
            if stats.get("total_chunks", 0) > 0:
                self.rag_available = True
                print(f"✅ RAG system loaded: {stats['total_chunks']} chunks available")
            else:
                print("⚠️  RAG database empty - using intelligent fallback")
                
        except Exception as e:
            # RAG failed to load - use intelligent fallback
            print(f"ℹ️  RAG unavailable (using intelligent fallback): {e}")
            self.rag_available = False
    
    async def is_navigation_query(self, message: str, current_step: str) -> Dict[str, Any]:
        """Classify navigation vs support"""
        message_lower = message.lower().strip()
        
        # Confirmation = navigation
        if message_lower in ['yes', 'ok', 'sure', 'yeah', 'yep', 'yup', 'y', 'k', 'okay']:
            return {
                "is_navigation": True,
                "intent": "navigation",
                "confidence": 0.95,
                "reasoning": "User confirmed"
            }
            
        # Numeric selection (1-5)
        if message.strip().isdigit() and 1 <= int(message.strip()) <= 5:
            return {
                "is_navigation": True,
                "intent": "navigation",
                "confidence": 0.95,
                "reasoning": "Numeric selection"
            }
        
        # Navigation keywords
        nav_keywords = ['next', 'continue', 'back', 'previous', 'go to', 'change url', 
                        'new url', 'start over', 'restart', 'http', 'www', '.com', 'https',
                        'proceed', 'confirm', 'go ahead', 'forward', 'move on']
        
        if any(keyword in message_lower for keyword in nav_keywords):
            return {
                "is_navigation": True,
                "intent": "navigation",
                "confidence": 0.9,
                "reasoning": "Navigation command"
            }
        
        # Everything else = support
        return {
            "is_navigation": False,
            "intent": "support",
            "confidence": 0.9,
            "reasoning": "Help question"
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
        
        # If we reach here, RAG failed or is unavailable.
        # User requested NO HARDCODED KEYWORDS.
        return {
            "answer": "I'm encountering an issue connecting to my knowledge base. Please ask again or contact support if this persists.",
            "confidence": 0.0,
            "sources": [],
            "suggested_actions": []
        }

# Singleton
_support_service = None

def get_support_service() -> SupportService: # Singleton access
    """Get support service instance"""
    global _support_service
    if _support_service is None:
        _support_service = SupportService()
    return _support_service
