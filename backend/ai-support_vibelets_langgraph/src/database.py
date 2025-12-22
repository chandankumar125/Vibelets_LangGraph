import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from src.config import settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages ChromaDB operations"""
    
    def __init__(self):
        self.client = None
        self.collection = None
        self.initialize_client()
    
    def initialize_client(self) -> None:
        """Initialize ChromaDB client and collection"""
        try:
            # Create ChromaDB client with persistent storage
            # Newer ChromaDB API doesn't need Settings
            self.client = chromadb.PersistentClient(path=settings.chroma_db_path)
            
            # Get or create collection
            self.collection = self.client.get_or_create_collection(
                name=settings.collection_name,
                metadata={"description": "RAG system book collection"}
            )
            
            logger.info(f"Database initialized successfully. Collection: {settings.collection_name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics"""
        try:
            count = self.collection.count()
            return {
                "total_chunks": count,
                "collection_name": settings.collection_name,
                "status": "connected" if self.client else "disconnected"
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {
                "total_chunks": 0,
                "collection_name": settings.collection_name,
                "status": "error"
            }
    
    def clear_collection(self) -> bool:
        """Clear all data from collection"""
        try:
            # Delete and recreate collection
            self.client.delete_collection(settings.collection_name)
            self.collection = self.client.create_collection(
                name=settings.collection_name,
                metadata={"description": "RAG system book collection"}
            )
            logger.info("Collection cleared successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to clear collection: {e}")
            return False
    
    def add_documents(
        self,
        documents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: List[str]
    ) -> bool:
        """Add documents to the collection"""
        try:
            self.collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(documents)} documents to collection")
            return True
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            return False
    
    def query_documents(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 5
    ) -> Dict[str, Any]:
        """Query documents from the collection"""
        try:
            results = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
            return results
        except Exception as e:
            logger.error(f"Failed to query documents: {e}")
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
    
    def get_available_books(self) -> List[str]:
        """Get list of available books in the collection"""
        try:
            # Get all unique book names from metadata
            all_data = self.collection.get(include=["metadatas"])
            books = set()
            
            for metadata in all_data["metadatas"]:
                if "book_name" in metadata:
                    books.add(metadata["book_name"])
            
            return list(books)
        except Exception as e:
            logger.error(f"Failed to get available books: {e}")
            return []
    
    def health_check(self) -> bool:
        """Check if database is healthy"""
        try:
            if self.client and self.collection:
                # Try to get collection count
                self.collection.count()
                return True
            return False
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False


# Global database instance
db_manager = DatabaseManager()