#!/usr/bin/env python3
"""
Simple RAG Training Test
"""
import sys
from pathlib import Path

# Add ai-support to path
ai_support_path = Path(__file__).parent / "ai-support_vibelets_langgraph"
sys.path.insert(0, str(ai_support_path))

print("="*60)
print("RAG Training Test")
print("="*60)

try:
    from src.rag_services import RAGService
    
    print("\n1. Creating RAG service...")
    rag_service = RAGService()
    print("   ✅ RAG service created")
    
    print("\n2. Training model...")
    result = rag_service.train_model(overwrite_existing=True)
    print(f"   Status: {result.status}")
    print(f"   Message: {result.message}")
    print(f"   Chunks: {result.total_chunks}")
    print(f"   Books: {result.books_processed}")
    
    if result.status == "success":
        print("\n✅ Training successful!")
    else:
        print(f"\n❌ Training failed: {result.message}")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*60)
