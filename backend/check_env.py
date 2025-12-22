import sys
import os

print(f"Python: {sys.executable}")
try:
    import chromadb
    print(f"✅ ChromaDB version: {chromadb.__version__}")
    print(f"   Location: {os.path.dirname(chromadb.__file__)}")
except ImportError:
    print("❌ ChromaDB NOT found")

try:
    import openai
    print(f"✅ OpenAI version: {openai.__version__}")
except ImportError:
    print("❌ OpenAI NOT found")

print("\nIf ChromaDB is found above, please RESTART your uvicorn server to pick up the change.")
