import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
import PyPDF2
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from src.config import settings

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """Handles document processing and embedding generation"""
    
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        self.embedding_model = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key
        )
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file"""
        text = ""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    except Exception as e:
                        logger.warning(f"Failed to extract text from page {page_num} of {pdf_path}: {e}")
                        continue
                
            logger.info(f"Successfully extracted text from {os.path.basename(pdf_path)}")
            
        except Exception as e:
            logger.error(f"Error reading {pdf_path}: {e}")
            return ""
        
        return text.strip()
    
    def extract_text_from_markdown(self, md_path: str) -> str:
        """Extract text from Markdown file"""
        try:
            with open(md_path, 'r', encoding='utf-8') as file:
                text = file.read()
            logger.info(f"Successfully extracted text from {os.path.basename(md_path)}")
            return text.strip()
        except Exception as e:
            logger.error(f"Error reading {md_path}: {e}")
            return ""
    
    def split_text_into_chunks(self, text: str) -> List[str]:
        """Split text into chunks using the configured text splitter"""
        try:
            chunks = self.text_splitter.split_text(text)
            logger.info(f"Split text into {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Failed to split text: {e}")
            return []
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        try:
            logger.info(f"Generating embeddings for {len(texts)} texts")
            embeddings = self.embedding_model.embed_documents(texts)
            logger.info("Embeddings generated successfully")
            return embeddings
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise
    
    def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for a single query"""
        try:
            embedding = self.embedding_model.embed_query(query)
            return embedding
        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            raise
    
    def get_pdf_files(self) -> List[str]:
        """Get all PDF and Markdown files from the books directory"""
        try:
            books_path = Path(settings.books_path)
            files = []
            
            if books_path.exists():
                # Get PDF files
                for file_path in books_path.rglob("*.pdf"):
                    files.append(str(file_path))
                # Get Markdown files
                for file_path in books_path.rglob("*.md"):
                    files.append(str(file_path))
            
            logger.info(f"Found {len(files)} files (PDF + Markdown)")
            return files
            
        except Exception as e:
            logger.error(f"Failed to get files: {e}")
            return []
    
    def process_book(self, book_path: str) -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
        """Process a single book (PDF or Markdown) and return chunks, metadata, and IDs"""
        try:
            if not os.path.exists(book_path):
                logger.warning(f"Book not found: {book_path}")
                return [], [], []
            
            book_name = os.path.basename(book_path)
            logger.info(f"Processing book: {book_name}")
            
            # Extract text based on file type
            if book_path.endswith('.pdf'):
                text = self.extract_text_from_pdf(book_path)
            elif book_path.endswith('.md'):
                text = self.extract_text_from_markdown(book_path)
            else:
                logger.warning(f"Unsupported file type: {book_name}")
                return [], [], []
            
            if not text.strip():
                logger.warning(f"No text extracted from {book_name}")
                return [], [], []
            
            # Split text into chunks
            chunks = self.split_text_into_chunks(text)
            
            if not chunks:
                logger.warning(f"No chunks created from {book_name}")
                return [], [], []
            
            # Create metadata and IDs for each chunk
            metadatas = []
            ids = []
            
            for i, chunk in enumerate(chunks):
                metadatas.append({
                    "source": book_path,
                    "book_name": book_name,
                    "chunk_id": i,
                    "chunk_length": len(chunk),
                    "book_size": len(text)
                })
                ids.append(f"{book_name}_chunk_{i}")
            
            logger.info(f"Successfully processed {book_name}: {len(chunks)} chunks")
            return chunks, metadatas, ids
            
        except Exception as e:
            logger.error(f"Failed to process book {book_path}: {e}")
            return [], [], []
    
    def process_all_books(self) -> Tuple[List[str], List[List[float]], List[Dict[str, Any]], List[str], List[str]]:
        """Process all books in the books directory"""
        all_chunks = []
        all_metadatas = []
        all_ids = []
        processed_books = []
        
        try:
            pdf_files = self.get_pdf_files()
            
            if not pdf_files:
                logger.warning("No PDF files found in books directory")
                return [], [], [], [], []
            
            for book_path in pdf_files:
                chunks, metadatas, ids = self.process_book(book_path)
                
                if chunks:  # Only add if we have chunks
                    all_chunks.extend(chunks)
                    all_metadatas.extend(metadatas)
                    all_ids.extend(ids)
                    processed_books.append(os.path.basename(book_path))
            
            if not all_chunks:
                logger.error("No chunks were extracted from any books")
                return [], [], [], [], []
            
            # Generate embeddings for all chunks
            logger.info(f"Generating embeddings for {len(all_chunks)} total chunks")
            embeddings = self.generate_embeddings(all_chunks)
            
            logger.info(f"Successfully processed {len(processed_books)} books with {len(all_chunks)} total chunks")
            return all_chunks, embeddings, all_metadatas, all_ids, processed_books
            
        except Exception as e:
            logger.error(f"Failed to process books: {e}")
            return [], [], [], [], []


# Global document processor instance
doc_processor = DocumentProcessor()