import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # OpenAI Configuration
    openai_api_key: str
    
    # Database Configuration
    chroma_db_path: str = str(Path(__file__).parent.parent / "data" / "chroma_db")
    books_path: str = str(Path(__file__).parent.parent / "data" / "books")
    
    # MongoDB Configuration (optional - these will be picked up from env vars)
    mongodb_uri: Optional[str] = None
    mongo_db_name: str = "Adscale-PreProd-DB"
    
    # API Configuration
    host: str = "0.0.0.0"
    port: int = 10300
    debug: bool = True
    
    # Model Configuration
    chunk_size: int = 500
    chunk_overlap: int = 50
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4"
    
    # Collection name
    collection_name: str = "books_collection"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # This allows extra env vars without validation errors


# Create settings instance
settings = Settings()

# Ensure directories exist
Path(settings.chroma_db_path).mkdir(parents=True, exist_ok=True)
Path(settings.books_path).mkdir(parents=True, exist_ok=True)
