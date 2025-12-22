#!/usr/bin/env python3
"""
Test RAG Support Service
"""
import sys
from pathlib import Path

# Add ai-support to path
ai_support_path = Path(__file__).parent / "ai-support_vibelets_langgraph"
sys.path.insert(0, str(ai_support_path))

from src.rag_services import RAGService
from src.database import db_manager

print("="*60)
print("Testing RAG Support Service")
print("="*60)

# Check database stats
print("\n1. Checking database stats...")
stats = db_manager.get_collection_stats()
print(f"   Total chunks: {stats.get('total_chunks', 0)}")
print(f"   Available books: {db_manager.get_available_books()}")

# Train if needed
if stats.get('total_chunks', 0) == 0:
    print("\n2. Training RAG model...")
    rag_service = RAGService()
    result = rag_service.train_model(overwrite_existing=False)
    print(f"   Status: {result.status}")
    print(f"   Message: {result.message}")
    print(f"   Chunks: {result.total_chunks}")
    print(f"   Books: {result.books_processed}")
else:
    print("\n2. RAG already trained!")
    rag_service = RAGService()

# Test query
print("\n3. Testing query...")
question = "How do I create a campaign in Vibelets?"
result = rag_service.answer_question(question, top_k=3)
print(f"   Question: {question}")
print(f"   Answer: {result.get('answer', 'No answer')[:200]}...")
print(f"   Confidence: {result.get('confidence', 0)}")
print(f"   Sources: {len(result.get('sources', []))} sources")

print("\n" + "="*60)
print("Test complete!")
print("="*60)
