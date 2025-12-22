
import sys
print(f"Python: {sys.executable}")

try:
    import langchain_core
    from langchain_core.messages import RemoveMessage
    print(f"✅ langchain-core: {langchain_core.__version__} (RemoveMessage found)")
except ImportError as e:
    print(f"❌ langchain-core error: {e}")

try:
    import langgraph
    print(f"✅ langgraph: {langgraph.__version__}")
except ImportError as e:
    print(f"❌ langgraph error: {e}")

try:
    import chromadb
    print(f"✅ chromadb: {chromadb.__version__}")
except ImportError as e:
    print(f"❌ chromadb error: {e}")
