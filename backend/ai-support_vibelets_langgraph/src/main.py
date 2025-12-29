import logging
import sys
import uuid
import os
import shutil
import asyncio
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.config import settings
from src.models import (
    QuestionRequest, QuestionResponse, QuestionResponseData, TrainRequest, TrainResponse,
    HealthResponse, ErrorResponse, QuestionListResponse, QuestionListResponseData, HelpSupportQuestion,
    UserThreadResponse, UserThreadResponseData, UserThread, SupportTicket, TicketListResponse, 
    TicketListData, AdminTicketListResponse, AdminTicketListData, TicketCounts, 
    TicketAssignmentRequest, TicketAssignmentResponse, TicketStatusUpdateRequest, TicketStatusUpdateResponse,
    AdminUser, AdminUserListData, AdminUserListResponse,PublicChatRequest,AgentUserListResponse,AgentUserListData,AgentUser,
    FeedbackRequest
)
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from helpers.mongodb import MONGO_URI, MONGO_DB_NAME
from src.models import LoginRequest, LoginResponse, LoginResponseData
import jwt
from helpers.jwt_middleware import authorize, JWT_SECRET
from db.pg import query
from motor.motor_asyncio import AsyncIOMotorClient


from src.rag_services import rag_service
from helpers.mongodb import (
    check_existing_thread,
    migrate_missing_ticket_ids,
    create_threads,
    update_dialogs,
    get_thread_history_by_session_id,
    is_mongodb_configured,
    get_help_support_questions,
    get_user_last_thread,
    create_support_ticket,
    get_support_tickets,
    track_user_dissatisfaction,
    generate_support_response,
    get_dissatisfaction_count,
    get_admin_tickets,
    get_ticket_conversation,
    update_ticket_assignment,
    update_ticket_status,
    check_existing_ticket_for_thread,
    store_user_message_to_ticket,
    store_agent_response,
    get_satisfaction_count,
    get_latest_agent_response,
    update_message_feedback,
)

from helpers.ticket_scheduler import start_scheduler_background
from db.pg import get_admin_users

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('rag_system.log')
    ]
)

logger = logging.getLogger(__name__)

# Background training status
training_status = {"is_training": False, "last_result": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting RAG System API")
    logger.info(f"Books directory: {settings.books_path}")
    logger.info(f"Database path: {settings.chroma_db_path}")
    
    # Start the ticket auto-close scheduler as a background task
    scheduler_task = asyncio.create_task(start_scheduler_background())
    logger.info("Started ticket auto-close scheduler")
    
    yield
    
    # Cancel the scheduler task when shutting down
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        logger.info("Ticket auto-close scheduler stopped")
    
    logger.info("Shutting down RAG System API")


# Create FastAPI app
app = FastAPI(
    title="RAG System API",
    description="A Retrieval-Augmented Generation system for document Q&A",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication middleware
app.middleware("http")(authorize)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.debug else None
        ).dict()
    )


@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to RAG System API",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        status_info = rag_service.get_system_status()
        
        return HealthResponse(
            status=status_info["status"],
            database_status=status_info["database_status"],
            total_chunks=status_info["total_chunks"],
            available_books=status_info["available_books"]
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.post("/train", response_model=TrainResponse)
async def train_model_sync(request: TrainRequest):
    """Train the model synchronously (blocking)"""
    global training_status
    
    if training_status["is_training"]:
        raise HTTPException(status_code=409, detail="Training is already in progress")
    
    try:
        training_status["is_training"] = True
        logger.info(f"Starting synchronous training (overwrite: {request.overwrite_existing})")
        
        result = rag_service.train_model(overwrite_existing=request.overwrite_existing)
        training_status["last_result"] = result
        
        return result
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
    
    finally:
        training_status["is_training"] = False



@app.get("/train/status", response_model=dict)
async def get_training_status():
    """Get current training status"""
    global training_status
    
    return {
        "is_training": training_status["is_training"],
        "last_result": training_status["last_result"].dict() if training_status["last_result"] else None
    }


@app.post("/ask", response_model=QuestionResponse)
async def ask_question(question_request: QuestionRequest, request: Request):
    try:
        logger.info(f"Received question from user {question_request.user_id} (company {question_request.company_id})")

        thread_id = question_request.thread_id or str(uuid.uuid4())
        last_question = question_request.last_question or question_request.question
        is_dissatisfied = question_request.is_dissatisfied

        # RAG training lock
        if training_status["is_training"]:
            return QuestionResponse(
                statusCode=503, status=False,
                data=QuestionResponseData(
                    message="Model training in progress",
                    thread_id=thread_id
                )
            )

        # --- THREAD MANAGEMENT ---
        thread_object_id = await check_existing_thread(thread_id)
        if not thread_object_id:
            row = {
                "template_name": "RAG Session",
                "template_id": None,
                "session_id": thread_id
            }
            thread_object_id = await create_threads(row, question_request.user_id, question_request.company_id, question_request.question)

        # --- CHECK AGENT REPLY ---
        agent_reply = await get_latest_agent_response(thread_id, question_request.user_id)
        if agent_reply:
            return QuestionResponse(
                statusCode=200, status=True,
                data=QuestionResponseData(
                    message=f"[{agent_reply['agent_name']}]: {agent_reply['message']}",
                    thread_id=thread_id
                )
            )

        # --- CHECK EXISTING TICKET ---
        existing_ticket = await check_existing_ticket_for_thread(thread_id)
        if existing_ticket:
            await store_user_message_to_ticket(thread_id, question_request.question, question_request.user_id)
            return QuestionResponse(
                statusCode=200, status=True,
                data=QuestionResponseData(
                    message=f"Message sent to support agent",
                    thread_id=thread_id,
                    ticket_id=str(existing_ticket["ticket_id"])
                )
            )

        # --- TRACK DISSATISFACTION ---
        dissatisfaction_count = await track_user_dissatisfaction(thread_id, is_dissatisfied) or 0

        # --- CREATE TICKET IF NEEDED ---
        # --- CREATE TICKET IF NEEDED (Disabled) ---
        if is_dissatisfied and dissatisfaction_count >= 2:
            # Ticket creation commented out
            # ticket_id = await create_support_ticket(
            #     question=last_question,
            #     user_id=str(question_request.user_id),
            #     company_id=int(question_request.company_id),
            #     thread_id=thread_id,
            #     first_name=getattr(request.state, 'first_name', ''),
            #     last_name=getattr(request.state, 'last_name', '')
            # )
            # logger.info(f"Created support ticket {ticket_id}")

            msg = "I apologize that I couldn't help. If you are facing persistent issues, please mail us at support@adsparkx.com for further assistance."

            return QuestionResponse(
                statusCode=200, status=True,
                data=QuestionResponseData(
                    message=msg,
                    thread_id=thread_id,
                    ticket_id=None
                )
            )

        # --- NORMAL RAG RESPONSE ---
        rag_result = rag_service.answer_question(
            question=question_request.question,
            top_k=question_request.top_k,
            thread_id=thread_id,
            user_id=str(question_request.user_id),
            company_id=question_request.company_id
        )

        await update_dialogs(
            user_query=question_request.question,
            ai_response=rag_result["answer"],
            session_id=thread_id,
            thread_object_id=thread_object_id
        )
        
        # Schedule background hallucination check
        # if rag_result.get("run_id") and rag_result.get("context"):
        #     async def check_hallucination_background():
        #         try:
        #             from langsmith import Client as LangSmithClient
        #             check_result = rag_service.check_hallucination(
        #                 question=rag_result["question"],
        #                 context=rag_result["context"],
        #                 answer=rag_result["answer"]
        #             )
                    
        #             # Submit hallucination score to LangSmith
        #             try:
        #                 client = LangSmithClient()
        #                 client.create_feedback(
        #                     run_id=rag_result["run_id"],
        #                     key="hallucination_check",
        #                     score=check_result["score"],
        #                     comment=f"Evaluation: {check_result['evaluation_result']}"
        #                 )
        #             except Exception as e:
        #                 logger.warning(f"Failed to submit hallucination feedback to LangSmith: {e}")
        #         except Exception as e:
        #             logger.error(f"Background hallucination check failed: {e}")
            
        #     # Run in background
        #     import asyncio
        #     asyncio.create_task(check_hallucination_background())

        return QuestionResponse(
            statusCode=200,
            status=True,
            data=QuestionResponseData(
                message=rag_result["answer"],
                thread_id=thread_id,
                run_id=rag_result.get("run_id")
            )
        )

    except Exception as e:
        logger.error(f"Error: {e}")
        return QuestionResponse(
            statusCode=500,
            status=False,
            data=QuestionResponseData(
                message=str(e),
                thread_id=thread_id
            )
        )



@app.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """Submit satisfaction feedback for a dialog message"""
    try:
        if not is_mongodb_configured():
            return {"status": False, "message": "MongoDB not configured"}
            
        success = await update_message_feedback(feedback.dialog_id, feedback.is_satisfied)
        
        # Submit feedback to LangSmith if run_id is provided
        # if feedback.run_id:
        #     try:
        #         from langsmith import Client as LangSmithClient
        #         client = LangSmithClient()
                
        #         # Convert boolean to score (1.0 for satisfied, 0.0 for dissatisfied)
        #         score = 1.0 if feedback.is_satisfied else 0.0
                
        #         client.create_feedback(
        #             run_id=feedback.run_id,
        #             key="user_satisfaction",
        #             score=score,
        #             comment="User feedback: " + ("Helpful" if feedback.is_satisfied else "Not Helpful")
        #         )
        #         logger.info(f"Submitted user feedback to LangSmith: run_id={feedback.run_id}, score={score}")
        #     except Exception as e:
        #         logger.warning(f"Failed to submit feedback to LangSmith: {e}")
        
        if success:
            return {"status": True, "message": "Feedback recorded"}
        else:
            return {"status": False, "message": "Failed to record feedback"}
            
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask/stream")
async def ask_question_stream(question_request: QuestionRequest, request: Request):
    from fastapi.responses import StreamingResponse
    import json
    import re

    logger.info(
        f"[ASK-STREAM] user={question_request.user_id} company={question_request.company_id} "
        f"is_dissatisfied={question_request.is_dissatisfied} "
        f"question='{question_request.question[:80]}...'"
    )

    async def generate():
        try:
            # Create or reuse thread_id
            thread_id = question_request.thread_id or str(uuid.uuid4())
            logger.info(f"[ASK-STREAM] Using thread_id={thread_id}")

            yield f"data: {json.dumps({'thread_id': thread_id, 'type': 'thread_id'})}\n\n"

            # Training mode check
            if training_status["is_training"]:
                yield f"data: {json.dumps({'error': 'Training in progress'})}\n\n"
                return

            # ------------------------------
            # READ dissatisfaction_count FROM DB
            # ------------------------------
            dissatisfaction_count = await get_dissatisfaction_count(thread_id)
            logger.info(f"[ASK-STREAM] Current dissatisfaction_count={dissatisfaction_count}")

            # Read satisfaction count from DB
            satisfaction_count = await get_satisfaction_count(thread_id)
            logger.info(f"[ASK-STREAM] Current satisfaction_count={satisfaction_count}")

            # -----------------------------------------
            # END CHAT IF dissatisfaction_count >= 1
            # -----------------------------------------

            # END CHAT IF satisfaction_count >= 1
            if satisfaction_count >= 1:
                msg = "Thanks! Glad I could help 😊"

                yield f"data: {json.dumps({'content': msg, 'type': 'content'})}\n\n"
                yield f"data: {json.dumps({'type': 'end_chat', 'reason': 'satisfaction'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return


            if dissatisfaction_count == 1:
                msg = "I'm sorry the previous answer wasn't helpful."

                yield f"data: {json.dumps({'content': msg, 'type': 'content'})}\n\n"
                yield f"data: {json.dumps({'type': 'end_chat', 'reason': 'first_dissatisfaction'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # END CHAT IF dissatisfaction_count >= 2
            if dissatisfaction_count >= 2:
                msg = (
                    "I apologize that I couldn't help. "
                    "If you are facing persistent issues, please mail us at support@adsparkx.com."
                )

                yield f"data: {json.dumps({'content': msg, 'type': 'content'})}\n\n"
                yield f"data: {json.dumps({'type': 'end_chat', 'reason': 'multiple_dissatisfactions'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # ------------------------------
            # NORMAL RAG STREAMING
            # ------------------------------
            full_answer = ""
            logger.info("[ASK-STREAM] Starting normal RAG streaming output.")

            for chunk in rag_service.answer_question_stream(
                question=question_request.question,
                top_k=question_request.top_k,
                thread_id=thread_id,
                user_id=str(question_request.user_id),
                company_id=question_request.company_id
            ):

                if chunk.startswith("error:"):
                    yield f"data: {json.dumps({'error': chunk[7:]})}\n\n"
                    return

                full_answer += chunk
                yield f"data: {json.dumps({'content': chunk, 'type': 'content'})}\n\n"

            logger.info("[ASK-STREAM] Completed streaming RAG answer.")
            
            # Try to capture run_id from LangSmith
            run_id = None
            # try:
            #     from langsmith.run_helpers import get_current_run_tree
            #     current_run = get_current_run_tree()
            #     if current_run:
            #         run_id = str(current_run.id)
            # except Exception as e:
            #     logger.warning(f"[ASK-STREAM] Failed to get run_id: {e}")

            # ------------------------------
            # SAVE dialog to MongoDB (if enabled)
            # ------------------------------
            if is_mongodb_configured():
                try:
                    thread_obj = await check_existing_thread(thread_id)
                    if not thread_obj:
                        row = {
                            "template_name": f"RAG Session {question_request.question[:50]}...",
                            "template_id": None,
                            "session_id": thread_id
                        }
                        thread_obj = await create_threads(
                            row, question_request.user_id, question_request.company_id, question_request.question
                        )

                    ai_id = await update_dialogs(
                        user_query=question_request.question,
                        ai_response=full_answer,
                        session_id=thread_id,
                        thread_object_id=thread_obj
                    )

                    if ai_id:
                        yield f"data: {json.dumps({'type': 'dialog_id', 'id': ai_id})}\n\n"
                    
                    # Send run_id if available
                    if run_id:
                        yield f"data: {json.dumps({'type': 'run_id', 'id': run_id})}\n\n"

                except Exception as e:
                    logger.warning(f"[ASK-STREAM] Dialog save failed: {e}")

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"[ASK-STREAM] Fatal error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")




 

@app.post("/public/ask/stream")
async def public_ask_stream(public_request: PublicChatRequest):
    """
    Public chat endpoint (no login).
    - Uses email as identity
    - Streams RAG response
    - Stores conversation in MongoDB collection: public_chats
    """
    from fastapi.responses import StreamingResponse
    import json

    import re

    email = public_request.email.strip().lower()
    question = public_request.question.strip()

    # Email validation regex
    email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_pattern, email):
        return JSONResponse(
            status_code=400,
            content={"status": False, "message": "Invalid email format"}
        )

    top_k = public_request.top_k or 5

    # deterministic thread/session id per email
    thread_id = public_request.thread_id or f"public-{email}"

    async def generate():
        from motor.motor_asyncio import AsyncIOMotorClient

        full_answer = ""

        try:
            # Send thread id first so frontend can store it
            yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"

            # If RAG training is running, just tell user
            if training_status["is_training"]:
                yield f"data: {json.dumps({'error': 'Training in progress'})}\n\n"
                return

            # ---- RAG STREAMING ANSWER ----
            for chunk in rag_service.answer_question_stream(
                question=question,
                top_k=top_k
            ):
                if chunk.startswith("error:"):
                    yield f"data: {json.dumps({'error': chunk[7:]})}\n\n"
                    return

                full_answer += chunk
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"

            # ---- STORE IN MONGO (public_chats collection) ----
            if is_mongodb_configured():
                try:
                    mongo_client = AsyncIOMotorClient(MONGO_URI)
                    db = mongo_client[MONGO_DB_NAME]
                    public_chats = db["public_chats"]

                    now = datetime.utcnow()

                    # upsert conv doc
                    existing = await public_chats.find_one(
                        {"session_id": thread_id, "email": email}
                    )

                    user_msg = {
                        "role": "user",
                        "content": question,
                        "timestamp": now,
                    }
                    assistant_msg = {
                        "role": "assistant",
                        "content": full_answer,
                        "timestamp": now,
                    }

                    if not existing:
                        doc = {
                            "email": email,
                            "session_id": thread_id,
                            "created_at": now,
                            "updated_at": now,
                            "messages": [user_msg, assistant_msg],
                            "last_question": question,
                            "last_answer": full_answer,
                        }
                        await public_chats.insert_one(doc)
                    else:
                        await public_chats.update_one(
                            {"_id": existing["_id"]},
                            {
                                "$set": {
                                    "updated_at": now,
                                    "last_question": question,
                                    "last_answer": full_answer,
                                },
                                "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
                            },
                        )

                    mongo_client.close()
                except Exception as me:
                    logger.warning(f"Failed to store public chat: {me}")

            # finish
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Public stream failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/books", response_model=dict)
async def list_available_books():
    """List all available books in the system"""
    try:
        from src.database import db_manager
        from src.document_processor import doc_processor
        import os

        db_books = db_manager.get_available_books()
        pdf_files = doc_processor.get_pdf_files()
        directory_books = [os.path.basename(f) for f in pdf_files]
        stats = db_manager.get_collection_stats()

        return {
            "status": True,
            "data": {
                "books_in_database": db_books,
                "books_in_directory": directory_books,
                "total_chunks": stats.get("total_chunks", 0),
                "database_status": stats.get("status", "unknown")
            }
        }

    except Exception as e:
        logger.error(f"Failed to list books: {e}")
        return {"status": False, "detail": str(e)}



@app.delete("/database", response_model=dict)
async def clear_database():
    """Clear all data from the database"""
    try:
        from src.database import db_manager
        
        success = db_manager.clear_collection()
        
        if success:
            return {
                "message": "Database cleared successfully",
                "status": "success"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to clear database")
            
    except Exception as e:
        logger.error(f"Failed to clear database: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear database: {str(e)}")


@app.post("/admin/upload", response_model=dict)
async def upload_document_admin(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload a document to the books directory (Admin only)"""
    # 1. Check Admin Auth
    if not hasattr(request.state, "role") or request.state.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        # 2. Check file type
        if not file.filename.lower().endswith(".pdf"):
             raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # 3. Save file
        books_path = settings.books_path
        os.makedirs(books_path, exist_ok=True)
        
        file_path = os.path.join(books_path, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Admin uploaded file: {file.filename}")
            
        return {
            "status": True,
            "message": f"File '{file.filename}' uploaded successfully",
            "file_path": str(file_path)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/config", response_model=dict)
async def get_configuration():
    """Get current system configuration"""
    return {
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "embedding_model": settings.embedding_model,
        "llm_model": settings.llm_model,
        "collection_name": settings.collection_name,
        "books_path": settings.books_path,
        "database_path": settings.chroma_db_path
    }


@app.get("/question_list", response_model=QuestionListResponse)
async def get_question_list():
    """Get list of help support questions from MongoDB"""
    try:
        # If MongoDB is not configured, return empty list (no storage required)
        if not is_mongodb_configured():
            return QuestionListResponse(
                statusCode=200,
                status=True,
                data=QuestionListResponseData(
                    questions=[],
                    total_count=0
                )
            )

        # Fetch questions from MongoDB (if configured)
        result = await get_help_support_questions(limit=10)
        if result is None:
            return QuestionListResponse(
                statusCode=200,
                status=True,
                data=QuestionListResponseData(
                    questions=[],
                    total_count=0
                )
            )
        
        # Convert to response format
        questions = [
            HelpSupportQuestion(
                id=q["id"],
                platform=q["platform"],
                question=q["question"],
                answer=q["answer"]
            )
            for q in result["questions"]
        ]
        
        return QuestionListResponse(
            statusCode=200,
            status=True,
            data=QuestionListResponseData(
                questions=questions,
                total_count=result["total_count"]
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch question list: {e}")
        return QuestionListResponse(
            statusCode=500,
            status=False,
            data=QuestionListResponseData(
                questions=[],
                total_count=0
            )
        )

@app.get("/get_thread_history_by_session_id")
async def get_thread_history_by_session_id_endpoint(session_id: str):
    """
    Return conversation history for a thread using session_id.
    Used by: user tickets + agent dashboard.
    """
    try:
        data = await get_thread_history_by_session_id(session_id)
        # helper already returns {status, statusCode, data}
        if data is None:
            return {"status": True, "statusCode": 200, "data": []}
        return data
    except Exception as e:
        logger.error(f"Error in get_thread_history_by_session_id_endpoint: {e}")
        return {
            "status": False,
            "statusCode": 500,
            "message": str(e),
            "data": []
        }

@app.get("/ticket/conversation")
async def get_ticket_conversation_endpoint(thread_id: str):
    """
    Get ticket conversation (USER and HUMAN_AGENT messages only, after ticket creation)
    This filters out pre-ticket AI responses and shows only the actual support conversation
    """
    try:
        logger.info(f"📥 Fetching ticket conversation for thread_id: {thread_id}")
        
        if not is_mongodb_configured():
            return {
                "status": True,
                "statusCode": 200,
                "data": []
            }
        
        result = await get_ticket_conversation(thread_id)
        
        if result is None:
            logger.warning(f"⚠️ No conversation found for thread_id: {thread_id}")
            return {
                "status": True,
                "statusCode": 200,
                "data": []
            }
        
        message_count = len(result.get("data", []))
        logger.info(f"✅ Returning {message_count} ticket conversation messages for thread_id: {thread_id}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error getting ticket conversation: {e}")
        return {
            "status": False,
            "statusCode": 500,
            "message": str(e),
            "data": []
        }

@app.get("/get_user_threads", response_model=UserThreadResponse)
async def get_user_threads(user_id: str, company_id: int):
    try:
        if not is_mongodb_configured():
            return UserThreadResponse(
                statusCode=200, status=True,
                data=UserThreadResponseData(thread=None)
            )

        # Convert to string ONLY for Mongo filter
        mongo_user_id = str(user_id)
        mongo_company_id = int(company_id)

        thread = await get_user_last_thread(mongo_user_id, mongo_company_id)

        if not thread:
            return UserThreadResponse(
                statusCode=200, status=True,
                data=UserThreadResponseData(thread=None)
            )

        #  Convert back to int for Pydantic output
        thread["company_id"] = int(thread.get("company_id", 0))

        return UserThreadResponse(
            statusCode=200, status=True,
            data=UserThreadResponseData(thread=UserThread(**thread))
        )

    except Exception as e:
        logger.error(f"Failed to fetch user's last thread: {e}")
        return UserThreadResponse(
            statusCode=500,
            status=False,
            data=UserThreadResponseData(thread=None)
        )




@app.get("/tickets", response_model=TicketListResponse)
async def get_support_tickets_endpoint(
    user_id: str = None,
    company_id: int = None,
    status: str = None,
    limit: int = 50
):
    try:
        if not is_mongodb_configured():
            return TicketListResponse(
                statusCode=200, status=True,
                data=TicketListData(
                    tickets=[], total_count=0, filters_applied={}
                )
            )

        #  Convert ONLY for Mongo filtering — strict FIX
        mongo_user_id = str(user_id) if user_id else None
        mongo_company_id = int(company_id) if company_id is not None else None

        # use converted ids
        result = await get_support_tickets(
            mongo_user_id,
            mongo_company_id,
            status,
            limit
        )

        if not result:
            return TicketListResponse(
                statusCode=200, status=True,
                data=TicketListData(
                    tickets=[], total_count=0, filters_applied={}
                )
            )

       
        tickets = [
            SupportTicket(
                _id=t["id"],
                question=t.get("question"),
                user_id=str(t.get("user_id")),
                company_id=int(t.get("company_id")) if t.get("company_id") else 0,
                ticket_status=t.get("ticket_status"),
                thread_id=t.get("thread_id"),
                description=t.get("description"),
                module_name=t.get("module_name"),
                priority=t.get("priority", "medium"),
                first_name=t.get("first_name"),
                last_name=t.get("last_name"),
                assigned_to_id=t.get("assigned_to_id"),
                assigned_to_name=t.get("assigned_to_name"),
                created_at=t.get("created_at"),
                updated_at=t.get("updated_at"),
                ticket_id=str(t.get("ticket_id")) if t.get("ticket_id") else None,
                has_user_notification=t.get("has_user_notification", False),
                has_agent_notification=t.get("has_agent_notification", False),
            )
            for t in result["tickets"]
        ]

        return TicketListResponse(
            statusCode=200,
            status=True,
            data=TicketListData(
                tickets=tickets,
                total_count=result["total_count"],
                filters_applied=result["filters_applied"]
            )
        )

    except Exception as e:
        logger.error(f"Failed to get support tickets: {e}")
        return TicketListResponse(
            statusCode=500,
            status=False,
            message=str(e)
        )




@app.get("/admin/ticketList", response_model=AdminTicketListResponse)
async def get_admin_ticket_list(
    request: Request,
    user_id: str = None,
    ticket_name: str = None,
    ticket_id: str = None,
    ticket_status: str = None,
    priority: str = None,
    page: int = 1,
    page_size: int = 10
):
    """Get admin ticket list with filtering and pagination - Admin only"""
    try:
        # Check for admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return AdminTicketListResponse(
                statusCode=403,
                status=False,
                message="Admin access required"
            )
        
        # If MongoDB is not configured, return empty admin ticket list
        if not is_mongodb_configured():
            return AdminTicketListResponse(
                statusCode=200,
                status=True,
                data=AdminTicketListData(
                    ticket_counts=TicketCounts(
                        total_tickets=0,
                        total_open=0,
                        total_in_progress=0,
                        total_resolved=0
                    ),
                    tickets=[],
                    pagination={
                        "current_page": page,
                        "page_size": page_size,
                        "total_pages": 0,
                        "total_items": 0,
                        "has_next": False,
                        "has_prev": False
                    },
                    filters_applied={}
                )
            )
        
        # Validate pagination parameters
        if page < 1:
            page = 1
        if page_size < 1 or page_size > 100:
            page_size = 10
            
        # Get admin tickets with filtering and pagination
        result = await get_admin_tickets(
            user_id=user_id,
            ticket_name=ticket_name,
            ticket_id=ticket_id,
            ticket_status=ticket_status,
            priority=priority,
            page=page,
            page_size=page_size
        )
        
        if result is None:
            return AdminTicketListResponse(
                statusCode=200,
                status=True,
                data=AdminTicketListData(
                    ticket_counts=TicketCounts(
                        total_tickets=0,
                        total_open=0,
                        total_in_progress=0,
                        total_resolved=0
                    ),
                    tickets=[],
                    pagination={
                        "current_page": page,
                        "page_size": page_size,
                        "total_pages": 0,
                        "total_items": 0,
                        "has_next": False,
                        "has_prev": False
                    },
                    filters_applied={}
                )
            )
        
        # Convert ticket data to SupportTicket models
        tickets = [
            SupportTicket(
                _id=ticket["id"],
                question=ticket["question"] if ticket["question"] is not None else None,
                user_id=str(ticket["user_id"]),
                company_id=ticket["company_id"],
                ticket_status=ticket["ticket_status"],
                thread_id=ticket.get("thread_id"),
                description=ticket.get("description"),
                module_name=ticket.get("module_name"),
                priority=ticket.get("priority", ""),
                assigned_to_id=ticket.get("assigned_to_id"),
                assigned_to_name=ticket.get("assigned_to_name"),
                first_name=ticket.get("first_name"),
                last_name=ticket.get("last_name"),
                ticket_id=str(ticket.get("ticket_id")) if ticket.get("ticket_id") is not None else None,
                created_at=ticket["created_at"] or "",
                updated_at=ticket["updated_at"] or "",
                has_user_notification=ticket.get("has_user_notification", False),
                has_agent_notification=ticket.get("has_agent_notification", False)
            )
            for ticket in result["tickets"]
        ]
        
        return AdminTicketListResponse(
            statusCode=200,
            status=True,
            data=AdminTicketListData(
                ticket_counts=result["ticket_counts"],
                tickets=tickets,
                pagination=result["pagination"],
                filters_applied=result["filters_applied"]
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to get admin ticket list: {e}")
        return AdminTicketListResponse(
            statusCode=500,
            status=False,
            message=str(e)
        )



@app.post("/ticket/user-reply")
async def user_reply(request: Request, data: dict):
    try:
        # Validate required fields
        if "thread_id" not in data or "message" not in data:
            return {
                "status": False,
                "message": "Missing thread_id or message"
            }

        # Get user_id from JWT token
        user_id = getattr(request.state, "user_id", None)

        if not user_id:
            return {
                "status": False,
                "message": "Unauthorized: user_id missing from token"
            }

        # Store the user message
        success = await store_user_message_to_ticket(
            thread_id=data["thread_id"],
            user_message=data["message"],
            user_id=str(user_id)
        )

        if not success:
            return {"status": False, "message": "Failed to store user message"}

        return {
            "status": True,
            "message": "Message saved"
        }

    except Exception as e:
        return {"status": False, "message": str(e)}



@app.post("/agent/reply")
async def agent_reply(request: Request, reply_data: dict):
    """Agent sends reply to user in ticket conversation - Agent/Admin only"""
    from helpers.mongodb import MONGO_URI, MONGO_DB_NAME
    
    try:
        # Check for agent/admin privileges
        user_role = getattr(request.state, "role", "")
        is_admin = getattr(request.state, "is_admin", False)
        
        if user_role not in ["agent", "admin"] and not is_admin:

            return JSONResponse(
                status_code=403,
                content={
                    "statusCode": 403,
                    "status": False,
                    "message": "Agent or Admin access required"
                }
            )
        
        if not is_mongodb_configured():
            return {
                "statusCode": 503,
                "status": False,
                "message": "MongoDB not configured"
            }
        
        # Required fields validation
        required_fields = ["thread_id", "message", "agent_id", "agent_name"]
        for field in required_fields:
            if field not in reply_data:
                return JSONResponse(
                    status_code=400,
                    content={
                        "statusCode": 400,
                        "status": False,
                        "message": f"Missing required field: {field}"
                    }
                )
        
        # Store agent response
        success = await store_agent_response(
            thread_id=reply_data["thread_id"],
            agent_message=reply_data["message"],
            agent_id=reply_data["agent_id"],
            agent_name=reply_data["agent_name"]
        )
        
        if not success:
            return JSONResponse(
                status_code=500,
                content={
                    "statusCode": 500,
                    "status": False,
                    "message": "Failed to save agent reply"
                }
            )
        
        # Update notification flag for user
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo = AsyncIOMotorClient(MONGO_URI)[MONGO_DB_NAME]["support_tickets"]
        
        await mongo.update_one(
            {"thread_id": reply_data["thread_id"]},
            {"$set": {
                "has_user_notification": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return {
            "statusCode": 200,
            "status": True,
            "message": "Reply sent and user notified successfully"
        }
        
    except Exception as e:
        logger.error(f"Agent reply error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "statusCode": 500,
                "status": False,
                "message": f"Failed to send reply: {str(e)}"
            }
        )

@app.get("/admin/agents", response_model=AgentUserListResponse)
async def get_agent_users_endpoint(request: Request):
    """Get list of all agent users - Admin only"""
    try:
        # Check admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return AgentUserListResponse(
                statusCode=403,
                status=False,
                message="Admin access required",
                data=None
            )

        from db.pg import get_agent_users  # Safe import
        
        result = get_agent_users()

        if result is None:
            return AgentUserListResponse(
                statusCode=500,
                status=False,
                message="Database connection failed",
                data=None
            )

        if "error" in result:
            return AgentUserListResponse(
                statusCode=500,
                status=False,
                message=f"Database error: {result['error']}",
                data=None
            )

        # Convert DB users → AgentUser model
        agent_users = [
            AgentUser(
                id=int(user["id"]),
                first_name=user.get("first_name", ""),
                last_name=user.get("last_name", ""),
                company_id=int(user.get("company_id", 0)),
                uuid=user.get("uuid", ""),
                is_admin=bool(user.get("is_admin", False)),
                role=user.get("role", "agent")
            )
            for user in result["users"]
        ]

        return AgentUserListResponse(
            statusCode=200,
            status=True,
            data=AgentUserListData(
                users=agent_users,
                total_count=int(result["total_count"])
            )
        )

    except Exception as e:
        logger.error(f"Failed to get agent users: {e}")
        return AgentUserListResponse(
            statusCode=500,
            status=False,
            message=f"Failed to get agent users: {str(e)}",
            data=None
        )


@app.get("/agent/my-tickets")
async def agent_specific_tickets(agent_name: str, page: int = 1, page_size: int = 10):
    """
    Exclusive endpoint for agent dashboard — returns ONLY tickets assigned to the agent
    Matches UI structure expected by frontend
    """

    from motor.motor_asyncio import AsyncIOMotorClient
    from helpers.mongodb import MONGO_URI, MONGO_DB_NAME

    try:
        mongo = AsyncIOMotorClient(MONGO_URI)[MONGO_DB_NAME]["support_tickets"]

        # Case-insensitive name match ✔
        query = { "assigned_to_name": {"$regex": f"^{agent_name}$", "$options": "i"} }

        total = await mongo.count_documents(query)
        skip = (page-1)*page_size

        cursor = mongo.find(query).sort("created_at", -1).skip(skip).limit(page_size)

        tickets = []
        async for t in cursor:
            tickets.append({
                "ticket_id": t.get("ticket_id"),
                "thread_id": t.get("thread_id"),
                "question": t.get("question"),
                "description": t.get("description"),
                "module_name": t.get("module_name"),
                "user_id": str(t.get("user_id")),
                "priority": t.get("priority","medium"),
                "ticket_status": t.get("ticket_status"),
                "created_at": t.get("created_at"),
                "updated_at": t.get("updated_at")
            })

        return {
            "status": True,
            "message": "Agent tickets loaded ✔",
            "data": {
                "tickets": tickets,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1)//page_size
                }
            }
        }

    except Exception as e:
        return {"status": False, "message": str(e)}

@app.put("/admin/tickets/assign", response_model=TicketAssignmentResponse)
async def assign_ticket(
    request: Request,
    assignment_request: TicketAssignmentRequest
):
    """Assign ticket priority and support person - Admin only"""
    try:
        # Check for admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return TicketAssignmentResponse(
                statusCode=403,
                status=False,
                message="Admin access required"
            )

        if not is_mongodb_configured():
            return TicketAssignmentResponse(
                statusCode=200,
                status=True,
                message="MongoDB not configured; operation skipped",
                data=None
            )

        # Update ticket assignment
        result = await update_ticket_assignment(
            ticket_id=assignment_request.ticket_id,
            priority=assignment_request.priority,
            assigned_to_id=assignment_request.assigned_to_id,
            assigned_to_name=assignment_request.assigned_to_name
        )

        if result is None:
            return TicketAssignmentResponse(
                statusCode=500,
                status=False,
                message="Database error occurred"
            )

        if "error" in result:
            status_code = 400 if result["error"] in ["No fields to update provided", "Invalid priority. Must be one of: low, medium, high, urgent"] else 404
            return TicketAssignmentResponse(
                statusCode=status_code,
                status=False,
                message=result["error"]
            )

        return TicketAssignmentResponse(
            statusCode=200,
            status=True,
            message="Ticket assignment updated successfully",
            data=result["ticket"]
        )

    except Exception as e:
        logger.error(f"Failed to assign ticket: {e}")
        return TicketAssignmentResponse(
            statusCode=500,
            status=False,
            message=f"Failed to assign ticket: {str(e)}"
        )

@app.put("/admin/tickets/status", response_model=TicketStatusUpdateResponse)
async def update_ticket_status_endpoint(
    request: Request,
    status_request: TicketStatusUpdateRequest
):
    """Update ticket status (open->in_progress or in_progress->closed) - Admin only"""
    try:
        # Check for admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return TicketStatusUpdateResponse(
                statusCode=403,
                status=False,
                message="Admin access required"
            )
        if not is_mongodb_configured():
            return TicketStatusUpdateResponse(
                statusCode=200,
                status=True,
                message="MongoDB not configured; operation skipped",
                data=None
            )

        # Update ticket status
        result = await update_ticket_status(
            ticket_id=status_request.ticket_id,
            action=status_request.action
        )

        if result is None:
            return TicketStatusUpdateResponse(
                statusCode=500,
                status=False,
                message="Database error occurred"
            )

        if "error" in result:
            # Determine status code based on error type
            if result["error"] == "Ticket not found":
                status_code = 404
            elif "Invalid action" in result["error"] or "Cannot" in result["error"]:
                status_code = 400
            else:
                status_code = 500

            return TicketStatusUpdateResponse(
                statusCode=status_code,
                status=False,
                message=result["error"]
            )

        return TicketStatusUpdateResponse(
            statusCode=200,
            status=True,
            message=result.get("message", "Ticket status updated successfully"),
            data=result["ticket"]
        )

    except Exception as e:
        logger.error(f"Failed to update ticket status: {e}")
        return TicketStatusUpdateResponse(
            statusCode=500,
            status=False,
            message=f"Failed to update ticket status: {str(e)}"
        )


@app.get("/admin/users", response_model=AdminUserListResponse)
async def get_admin_users_endpoint(request: Request):
    """Get list of all admin users - Admin only"""
    try:
        # Check for admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return AdminUserListResponse(
                statusCode=403,
                status=False,
                message="Admin access required"
            )
        
        # Fetch admin users from PostgreSQL
        result = get_admin_users()

        if result is None:
            return AdminUserListResponse(
                statusCode=500,
                status=False,
                message="Database connection failed"
            )

        if "error" in result:
            return AdminUserListResponse(
                statusCode=500,
                status=False,
                message=f"Database error: {result['error']}"
            )

        # Convert user data to AdminUser models
        admin_users = [
            AdminUser(
                id=str(user["id"]),  
                first_name=user.get("first_name", ""),
                last_name=user.get("last_name", ""),
                company_id=int(user.get("company_id", 0)),  
                uuid=user.get("uuid", ""),
                is_admin=bool(user.get("is_admin", False))  
            )
            for user in result["users"]
        ]

        return AdminUserListResponse(
            statusCode=200,
            status=True,
            data=AdminUserListData(
                users=admin_users,
                total_count=int(result["total_count"]) 
            )
        )

    except Exception as e:
        logger.error(f"Failed to get admin users: {e}")
        return AdminUserListResponse(
            statusCode=500,
            status=False,
            message=f"Failed to get admin users: {str(e)}"
        )

@app.post("/admin/migrate-ticket-ids")
async def migrate_ticket_ids_endpoint(request: Request):
    """One-time migration to add ticket_ids to existing tickets"""
    try:
        # Check for admin privileges
        if not getattr(request.state, "is_admin", False) and getattr(request.state, "role", "") != "admin":
            return JSONResponse(
                status_code=403,
                content={
                    "status": False,
                    "message": "Admin access required"
                }
            )
        from helpers.mongodb import migrate_missing_ticket_ids
        
        result = await migrate_missing_ticket_ids()
        
        if "error" in result:
            return JSONResponse(
                status_code=500,
                content={
                    "status": False,
                    "message": f"Migration failed: {result['error']}"
                }
            )
        
        return {
            "status": True,
            "statusCode": 200,
            "message": result.get("message", "Migration completed"),
            "updated_count": result.get("updated_count", 0)
        }
        
    except Exception as e:
        logger.error(f"Migration endpoint error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": False,
                "message": f"Migration failed: {str(e)}"
            }
        )

@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login endpoint to get JWT token"""
    try:
        # Mock/Dev Login for "admin"
        if request.username == "admin" and request.password == "admin":
             payload = {
                "user_id": "admin",
                "company_id": 1,
                "role": "admin",
                "is_admin": True,
                "is_agent": False,
                "email": "admin@example.com",
                "first_name": "Admin",
                "last_name": "User",
                "uuid": "admin-uuid",
                "exp": datetime.utcnow() + timedelta(hours=24)
             }
             token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
             return LoginResponse(
                statusCode=200,
                status=True,
                data=LoginResponseData(
                    token=token,
                    user_id="admin",
                    role="admin",
                    company_id=1
                )
             )

        # Mock/Dev Login for "user"
        if request.username == "user" and request.password == "user":
             payload = {
                "user_id": "user",
                "company_id": 1,
                "is_admin": False,
                "is_agent": False,
                "role": "user",
                "email": "user@example.com",
                "first_name": "Test",
                "last_name": "User",
                "uuid": "user-uuid",
                "exp": datetime.utcnow() + timedelta(hours=24)
             }
             token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
             return LoginResponse(
                statusCode=200,
                status=True,
                data=LoginResponseData(
                    token=token,
                    user_id="user",
                    role="user",
                    company_id=1
                )
             )
        
        # Real DB check (heuristic)
        users = query(
            "SELECT * FROM adu_users WHERE first_name = %s AND password = %s",
            (request.username, request.password)
        )
        
        if not users:
             return LoginResponse(
                statusCode=401,
                status=False,
                message="Invalid credentials"
             )
             
        user_data = users[0]
        
        db_role = user_data.get("role")  
        is_admin = user_data.get("is_admin", False)
        is_agent = True if db_role == "agent" else False

        role_value = (
            "admin" if is_admin else
            "agent" if is_agent else
            "user"
        )

        payload = {
            "user_id": str(user_data.get("id")),
            "company_id": int(user_data.get("company_id")),
            "role": role_value,
            "is_admin": is_admin,
            "is_agent": is_agent,
            "email": user_data.get("email", ""),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
            "uuid": user_data.get("uuid"),
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        
        return LoginResponse(
            statusCode=200,
            status=True,
            data=LoginResponseData(
                token=token,
                user_id=str(user_data.get("id")),
                role=role_value,
                company_id=int(user_data.get("company_id"))
            )
        )

    except Exception as e:
        logger.error(f"Login failed: {e}")
        return LoginResponse(
            statusCode=500,
            status=False,
            message=str(e)
        )


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on {settings.host}:{settings.port}")
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )