import logging
from typing import List, Dict, Any, Tuple, Optional
from openai import OpenAI
# from langsmith import traceable, Client as LangSmithClient
# from langsmith.run_helpers import get_current_run_tree
from src.config import settings
from src.database import db_manager
from src.document_processor import doc_processor
from src.models import RAGResponse, TrainResponse

logger = logging.getLogger(__name__)

# Initialize LangSmith client for feedback submission
# try:
#     langsmith_client = LangSmithClient()
# except Exception as e:
#     logger.warning(f"LangSmith client initialization failed: {e}. Tracing will be disabled.")
#     langsmith_client = None
langsmith_client = None

# Mock traceable decorator since we are disabling it
def traceable(**kwargs):
    def decorator(func):
        return func
    return decorator


class RAGService:
    """Main RAG service for training and question answering"""
    
    def __init__(self):
        self.openai_client = OpenAI(api_key=settings.openai_api_key)
    
    def train_model(self, overwrite_existing: bool = False) -> TrainResponse:
        """Train/update the RAG model by processing all books"""
        try:
            logger.info("Starting model training...")
            
            # Check existing data
            stats = db_manager.get_collection_stats()
            existing_count = stats.get("total_chunks", 0)
            
            if existing_count > 0 and not overwrite_existing:
                return TrainResponse(
                    status="skipped",
                    message=f"Database already contains {existing_count} chunks. Use overwrite_existing=True to retrain.",
                    total_chunks=existing_count,
                    books_processed=db_manager.get_available_books()
                )
            
            # Clear existing data if overwriting
            if existing_count > 0 and overwrite_existing:
                if not db_manager.clear_collection():
                    raise Exception("Failed to clear existing data")
                logger.info("Cleared existing data for retraining")
            
            # Process all books
            chunks, embeddings, metadatas, ids, processed_books = doc_processor.process_all_books()
            
            if not chunks:
                return TrainResponse(
                    status="error",
                    message="No documents were processed. Please check if PDF files exist in the books directory.",
                    total_chunks=0,
                    books_processed=[]
                )
            
            # Store in database
            success = db_manager.add_documents(chunks, embeddings, metadatas, ids)
            
            if not success:
                raise Exception("Failed to store documents in database")
            
            logger.info(f"Training completed successfully: {len(chunks)} chunks from {len(processed_books)} books")
            
            return TrainResponse(
                status="success",
                message=f"Successfully trained model with {len(chunks)} chunks from {len(processed_books)} books",
                total_chunks=len(chunks),
                books_processed=processed_books
            )
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return TrainResponse(
                status="error",
                message=f"Training failed: {str(e)}",
                total_chunks=0,
                books_processed=[]
            )
    
    @traceable(name="answer_question", run_type="chain")
    def answer_question(
        self, 
        question: str, 
        top_k: int = 5,
        thread_id: str = None,
        user_id: str = None,
        company_id: int = None
    ) -> Dict[str, Any]:
        """Answer a question using the RAG system"""
        try:
            logger.info(f"Answering question: {question[:100]}...")
            
            # Add metadata to current trace
            # try:
            #     from langsmith.run_helpers import get_current_run_tree
            #     current_run = get_current_run_tree()
            #     if current_run and thread_id:
            #         # Add thread context as metadata
            #         current_run.extra = {
            #             "thread_id": thread_id,
            #             "user_id": user_id,
            #             "company_id": company_id
            #         }
            # except Exception as e:
            #     logger.warning(f"Failed to add metadata to trace: {e}")
            
            # Check if database has data
            stats = db_manager.get_collection_stats()
            if stats.get("total_chunks", 0) == 0:
                raise Exception("No data in database. Please train the model first.")
            
            # Generate query embedding
            query_embedding = doc_processor.generate_query_embedding(question)
            
            # Search for relevant documents
            results = db_manager.query_documents(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            if not results["documents"][0]:
                return RAGResponse(
                    answer="I couldn't find any relevant information in the database to answer your question.",
                    sources=[],
                    confidence=0.0
                )
            
            # Prepare context and sources
            context_chunks = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]
            
            # Calculate confidence based on similarity scores (lower distance = higher confidence)
            avg_distance = sum(distances) / len(distances) if distances else 1.0
            confidence = max(0.0, min(1.0, 1.0 - avg_distance))
            
            # Create context
            context = "\n\n".join([
                f"[Source: {meta.get('book_name', 'Unknown')}]\n{chunk}"
                for chunk, meta in zip(context_chunks, metadatas)
            ])
            
            # Prepare sources information
            sources = []
            for i, (meta, distance) in enumerate(zip(metadatas, distances)):
                sources.append({
                    "book_name": meta.get("book_name", "Unknown"),
                    "chunk_id": meta.get("chunk_id", i),
                    "similarity_score": 1.0 - distance,  # Convert distance to similarity
                    "source_path": meta.get("source", "")
                })
            
            # Generate answer using OpenAI
            answer = self._generate_answer(question, context)
            
            logger.info("Question answered successfully")
            
            # Get the current run ID from LangSmith
            run_id = None
            # try:
            #     current_run = get_current_run_tree()
            #     if current_run:
            #         run_id = str(current_run.id)
            # except Exception as e:
            #     logger.warning(f"Failed to get LangSmith run ID: {e}")
            
            # Return both RAG response and run_id
            return {
                "answer": answer,
                "sources": sources,
                "confidence": confidence,
                "run_id": run_id,
                "context": context,  # Keep context for hallucination check
                "question": question
            }
            
        except Exception as e:
            logger.error(f"Failed to answer question: {e}")
            raise Exception(f"Failed to answer question: {str(e)}")
    
    @traceable(name="generate_answer", run_type="llm")
    def _generate_answer(self, question: str, context: str) -> str:
        """Generate answer using OpenAI GPT model"""
        try:
            prompt = f"""You are a friendly and knowledgeable support agent helping a user with their question. Based on the following context from our help documentation, please provide helpful assistance.

Context:
{context}

User's Question: {question}

Instructions:
- If the user's input is a simple greeting (e.g., "hi", "hello", "how are you"), respond with a friendly, concise one-liner greeting and offer help. Do NOT use the context for simple greetings.
- Respond in a helpful, supportive, and friendly tone as if you're providing customer support
- Start your response with phrases like "I'd be happy to help you with that!" or "Let me assist you with your question"
- Provide step-by-step guidance when applicable
- Use the information from the context to give accurate and detailed help
- If the context doesn't contain enough information, politely acknowledge this and suggest alternative ways to get help
- Be encouraging and reassuring in your response
- End with an offer for further assistance like "Feel free to ask if you need any more help!"

Your helpful response:"""
            
            response = self.openai_client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a friendly and professional customer support agent. Your goal is to help users solve their problems and answer their questions in a warm, supportive manner. Always be helpful, patient, and encouraging."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Failed to generate answer: {e}")
            raise Exception(f"Failed to generate answer with LLM: {str(e)}")

    def _generate_answer_stream(self, question: str, context: str):
        """Generate answer using OpenAI GPT model with streaming"""
        try:
            prompt = f"""You are a friendly and knowledgeable support agent helping a user with their question. Based on the following context from our help documentation, please provide helpful assistance.

Context:
{context}

User's Question: {question}

Instructions:
- If the user's input is a simple greeting (e.g., "hi", "hello", "how are you"), respond with a friendly, concise one-liner greeting and offer help. Do NOT use the context for simple greetings.
- Respond in a helpful, supportive, and friendly tone as if you're providing customer support
- Start your response with phrases like "I'd be happy to help you with that!" or "Let me assist you with your question"
- Provide step-by-step guidance when applicable
- Use the information from the context to give accurate and detailed help
- If the context doesn't contain enough information, politely acknowledge this and suggest alternative ways to get help
- Be encouraging and reassuring in your response
- End with an offer for further assistance like "Feel free to ask if you need any more help!"

Your helpful response:"""
            
            stream = self.openai_client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a friendly and professional customer support agent. Your goal is to help users solve their problems and answer their questions in a warm, supportive manner. Always be helpful, patient, and encouraging."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=1000,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
            
        except Exception as e:
            logger.error(f"Failed to generate streaming answer: {e}")
            raise Exception(f"Failed to generate streaming answer with LLM: {str(e)}")

    @traceable(name="answer_question_stream", run_type="chain")
    def answer_question_stream(
        self, 
        question: str, 
        top_k: int = 5,
        thread_id: str = None,
        user_id: str = None,
        company_id: int = None
    ):
        """Answer a question using the RAG system with streaming response"""
        try:
            logger.info(f"Answering question with streaming: {question[:100]}...")
            
            # Add metadata to current trace
            # try:
            #     from langsmith.run_helpers import get_current_run_tree
            #     current_run = get_current_run_tree()
            #     if current_run and thread_id:
            #         current_run.extra = {
            #             "thread_id": thread_id,
            #             "user_id": user_id,
            #             "company_id": company_id
            #         }
            # except Exception as e:
            #     logger.warning(f"Failed to add metadata to trace: {e}")
            
            # Check if database has data
            stats = db_manager.get_collection_stats()
            if stats.get("total_chunks", 0) == 0:
                yield "error: No data in database. Please train the model first."
                return
            
            # Generate query embedding
            query_embedding = doc_processor.generate_query_embedding(question)
            
            # Search for relevant documents
            results = db_manager.query_documents(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            if not results["documents"][0]:
                yield "I couldn't find any relevant information in the database to answer your question."
                return
            
            # Prepare context
            context_chunks = results["documents"][0]
            metadatas = results["metadatas"][0]
            
            # Create context
            context = "\n\n".join([
                f"[Source: {meta.get('book_name', 'Unknown')}]\n{chunk}"
                for chunk, meta in zip(context_chunks, metadatas)
            ])
            
            # Stream answer using OpenAI
            for chunk in self._generate_answer_stream(question, context):
                yield chunk
            
            logger.info("Question answered successfully with streaming")
            
        except Exception as e:
            logger.error(f"Failed to answer question with streaming: {e}")
            yield f"error: {str(e)}"

    @traceable(name="check_hallucination", run_type="llm")
    def check_hallucination(self, question: str, context: str, answer: str) -> Dict[str, Any]:
        """Use LLM as a judge to check if the answer is grounded in the context"""
        try:
            evaluation_prompt = f"""You are an expert evaluator. Your task is to determine if the provided answer is supported by the given context.

Context:
{context}

Question: {question}

Answer: {answer}

Evaluation Instructions:
- Determine if the answer is fully supported by the information in the context
- Look for any claims in the answer that are NOT present in the context
- Consider if the answer introduces information not found in the context

Respond with ONLY one of these:
- "GROUNDED" if the answer is fully supported by the context
- "HALLUCINATION" if the answer contains information not in the context or makes unsupported claims

Your evaluation:"""
            
            response = self.openai_client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert evaluator for RAG systems. You determine if generated answers are grounded in the provided context."
                    },
                    {
                        "role": "user",
                        "content": evaluation_prompt
                    }
                ],
                temperature=0.0,  # Use deterministic evaluation
                max_tokens=50
            )
            
            evaluation_result = response.choices[0].message.content.strip().upper()
            is_grounded = "GROUNDED" in evaluation_result
            
            logger.info(f"Hallucination check: {evaluation_result} - {'PASS' if is_grounded else 'FAIL'}")
            
            return {
                "is_grounded": is_grounded,
                "evaluation_result": evaluation_result,
                "score": 1.0 if is_grounded else 0.0
            }
            
        except Exception as e:
            logger.error(f"Hallucination check failed: {e}")
            return {
                "is_grounded": None,
                "evaluation_result": "ERROR",
                "score": 0.5,
                "error": str(e)
            }

    def get_system_status(self) -> Dict[str, Any]:
        """Get system status information"""
        try:
            stats = db_manager.get_collection_stats()
            available_books = db_manager.get_available_books()
            db_healthy = db_manager.health_check()
            
            return {
                "status": "healthy" if db_healthy else "unhealthy",
                "database_status": "connected" if db_healthy else "disconnected",
                "total_chunks": stats.get("total_chunks", 0),
                "available_books": available_books,
                "configuration": {
                    "chunk_size": settings.chunk_size,
                    "chunk_overlap": settings.chunk_overlap,
                    "embedding_model": settings.embedding_model,
                    "llm_model": settings.llm_model
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get system status: {e}")
            return {
                "status": "error",
                "database_status": "error",
                "total_chunks": 0,
                "available_books": [],
                "error": str(e)
            }


# Global RAG service instance
rag_service = RAGService()