#!/usr/bin/env python3
"""Test if RAG loads in server context"""
import sys
from pathlib import Path

# Simulate server environment
ai_support_path = Path(__file__).parent / "ai-support_vibelets_langgraph"
sys.path.insert(0, str(ai_support_path))

print("Testing RAG load...")

try:
    import chromadb
    print(f"✅ ChromaDB: {chromadb.__version__}")
    
    from src.rag_services import RAGService
    from src.database import db_manager
    
    print("✅ Imports successful")
    
    rag = RAGService()
    print("✅ RAG service created")
    
    stats = db_manager.get_collection_stats()
    print(f"✅ Database stats: {stats}")
    
    if stats.get("total_chunks", 0) > 0:
        print(f"✅ RAG READY: {stats['total_chunks']} chunks")
        
        # Test query
        result = rag.answer_question("what is Vibelets?", top_k=3)
        print(f"✅ Query successful")
        print(f"   Answer: {result.get('answer', '')[:100]}...")
    else:
        print("❌ No chunks in database")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
