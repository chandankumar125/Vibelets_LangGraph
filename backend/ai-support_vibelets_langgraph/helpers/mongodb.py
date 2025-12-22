# mongodb.py
"""
MongoDB operations for thread and dialog management
"""
from dotenv import load_dotenv
load_dotenv()
import os
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import random

# Import settings from config
try:
    from src.config import settings
    MONGO_URI = settings.mongodb_uri
    MONGO_DB_NAME = settings.mongo_db_name
except ImportError:
    # Fallback to environment variables if config import fails
    MONGO_URI = os.getenv("MONGODB_URI")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "Adscale-PreProd-DB")


async def check_existing_thread(session_id):
    """Check if thread already exists for this session_id"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "threads"

        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads_collection = mongo_db[MONGO_COLLECTION]

        # Find existing thread by session_id
        existing_thread = await threads_collection.find_one({
            "state.thread_id": session_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if existing_thread:
            print(f"📌 Found existing thread: {existing_thread['_id']} for session: {session_id}")
            return existing_thread['_id']  # Return ObjectId
        
        return None
        
    except Exception as e:
        print(f"❌ Error checking existing thread: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def create_threads(row, user_id, company_id, user_query=None):
    """Create a new thread entry in MongoDB"""
    
    # Skip if MongoDB is not configured
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - skipping thread creation")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "threads"

        # Mongo client
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        
        # Check if client was created successfully
        if mongo_client is None:
            print("❌ Failed to create MongoDB client")
            return None
            
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads_collection = mongo_db[MONGO_COLLECTION]

        created_at = updated_at = datetime.now()

        # Generate title based on user query or fallback to default
        if user_query and user_query.strip():
            # Truncate query to reasonable length for title
            title = user_query.strip()[:100]
            # Clean up the title
            if len(user_query.strip()) > 100:
                title = title.rsplit(' ', 1)[0] + "..."
        else:
            title = row.get("template_name", f"Analytics Session {created_at.strftime('%Y-%m-%d %H:%M')}")

        thread_data = {
            "title": title,
            "user_id": int(user_id) if user_id and str(user_id).isdigit() else user_id,  # ← FIXED 🚀
            "company_id": company_id,
            "description": f"Template created at {created_at}",
            "app_name": "HELP_SUPPORT",
            "is_deleted": False,
            "state": {
                "template_id": row.get("template_id"),
                "thread_id": str(row.get("session_id")),
            },
            "created_at": created_at,
            "updated_at": updated_at
        }

        # Insert and get the ObjectId
        result = await threads_collection.insert_one(thread_data)
        thread_object_id = result.inserted_id
        
        print(f"✅ Thread created successfully: '{title}' with ObjectId: {thread_object_id}")
        return thread_object_id
        
    except Exception as e:
        print(f"❌ Error creating thread: {e}")
        return None
    finally:
        # Always close the client if it exists
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass  # Ignore errors when closing


async def update_dialogs(user_query, ai_response, session_id, thread_object_id=None, is_greeting=False):
    """Store user queries and AI responses as dialog entries in MongoDB"""
    print(MONGO_URI)
    # Skip if MongoDB is not configured
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - skipping dialog storage")
        return None
        
    mongo_client = None
    try:
        MONGO_COLLECTION = "dialogs"

        # Mongo client
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        
        # Check if client was created successfully
        if mongo_client is None:
            print("❌ Failed to create MongoDB client")
            return None
            
        mongo_db = mongo_client[MONGO_DB_NAME]
        dialogs_collection = mongo_db[MONGO_COLLECTION]

        # If no thread_object_id provided, try to find existing thread
        if not thread_object_id:
            print(f"🔍 No thread ObjectId provided, searching for existing thread with session_id: {session_id}")
            threads_collection = mongo_db["threads"]
            existing_thread = await threads_collection.find_one({
                "state.thread_id": session_id,
                "app_name": "HELP_SUPPORT"
            })
            
            if existing_thread:
                thread_object_id = existing_thread['_id']
                print(f"✅ Found existing thread ObjectId: {thread_object_id}")
            else:
                print(f"❌ No thread found for session_id: {session_id}, skipping dialog storage")
                return None

        timestamp = datetime.now()
        dialog_entries = []
        user_id = None
        ai_id = None

        if user_query:
            user_data = {
                "thread_id": thread_object_id,  # Always use ObjectId from threads collection
                "app_name": "HELP_SUPPORT",
                "message": user_query,
                "type": "USER",
                "timestamp": timestamp
            }
            # Insert user message immediately to get ID order correct if needed, 
            # or just append to list. 
            # Actually insert_many preserves order.
            dialog_entries.append(user_data)

        if ai_response:
            model_data = {
                "thread_id": thread_object_id,  # Always use ObjectId from threads collection
                "app_name": "HELP_SUPPORT",
                "message": ai_response,
                "type": "MODEL",
                "timestamp": timestamp,
                "is_greeting": is_greeting,
                "satisfaction_count": 0,
                "dissatisfaction_count": 0
            }    
            dialog_entries.append(model_data)
        
        # Insert dialog entries
        if dialog_entries:
            result = await dialogs_collection.insert_many(dialog_entries)
            inserted_ids = result.inserted_ids
            
            # Map IDs roughly back to what we inserted
            # Assuming order is preserved: [User, AI]
            if user_query and ai_response and len(inserted_ids) >= 2:
                ai_id = str(inserted_ids[1])
            elif ai_response and len(inserted_ids) >= 1:
                ai_id = str(inserted_ids[0])

            # Update thread description using ObjectId
            update_query = {
                "$set": {
                    "description": user_query if user_query else ai_response,
                    "updated_at": timestamp
                }
            }

            filter_query = {
                "_id": thread_object_id  # Using ObjectId to find thread
            }

            await mongo_db["threads"].update_one(filter_query, update_query)

        print(f"✅ Dialog stored with thread_id ObjectId: {thread_object_id}")
        return ai_id
        
    except Exception as e:
        print(f"❌ Error storing dialog: {e}")
        return None
    finally:
        # Always close the client if it exists
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass  # Ignore errors when closing


async def update_message_feedback(dialog_id: str, is_satisfied: bool):
    """
    Update satisfaction/dissatisfaction count for a dialog message and its thread.
    is_satisfied: True for +1 satisfaction, False for +1 dissatisfaction.
    """
    if not MONGO_URI or MONGO_URI.strip() == "":
        return False

    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[MONGO_DB_NAME]
        dialogs = db["dialogs"]
        threads = db["threads"]

        # Parse dialog_id
        try:
            dialog_id = ObjectId(dialog_id)
        except:
            print(f"❌ Invalid dialog_id format: {dialog_id}")
            return False

        # Determine field to increment
        field_to_inc = "satisfaction_count" if is_satisfied else "dissatisfaction_count"

        # 1. Update Dialog
        result = await dialogs.find_one_and_update(
            {"_id": dialog_id},
            {"$inc": {field_to_inc: 1}},
            return_document=True
        )

        if not result:
            print(f"❌ Dialog not found for feedback: {dialog_id}")
            return False

        thread_id = result.get("thread_id")

        # 2. Update Thread Global Count
        if thread_id:
            await threads.update_one(
                {"_id": thread_id},
                {"$inc": {field_to_inc: 1}}
            )
            print(f"✅ Updated feedback for dialog {dialog_id} and thread {thread_id}")
            return True
        else:
            print(f"⚠️ Dialog {dialog_id} has no thread_id, skipped thread update")
            return True

    except Exception as e:
        print(f"❌ Error updating feedback: {e}")
        return False
    finally:
        if mongo_client:
            mongo_client.close()



async def get_thread_history(thread_id: str):
    """Return chat for ticket using real ObjectId lookup"""

    if not MONGO_URI or MONGO_URI.strip() == "":
        return None

    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[MONGO_DB_NAME]

        threads = db["threads"]
        dialogs = db["dialogs"]

        # First fetch the real ObjectId using thread_id
        thread = await threads.find_one({"state.thread_id": thread_id})

        if not thread:
            print("⚠ No thread found for given thread_id")
            return []

        thread_object_id = thread["_id"]   # Actual ID used inside dialogs

        # Now fetch dialogs using ObjectId instead of string
        cursor = dialogs.find({"thread_id": thread_object_id}).sort("timestamp", 1)

        history = []
        async for row in cursor:

            msg = {
                "content": row.get("message", ""),
                "type": "user" if row.get("type") == "USER" else "agent",
                "timestamp": row.get("timestamp").isoformat()
            }
            history.append(msg)

        return history

    except Exception as e:
        print(f"❌ Thread history fetch error:", e)
        return []
    finally:
        if mongo_client:
            mongo_client.close()



async def get_thread_history_by_session_id(session_id: str):
    """Get conversation history by session_id (finds thread first, then gets dialogs)"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        
        # First find the thread by session_id
        threads_collection = mongo_db["threads"]
        
        # Try multiple query patterns to find thread
        thread = await threads_collection.find_one({
            "state.thread_id": session_id,
        })
        
        # If not found, try alternate query
        if not thread:
            thread = await threads_collection.find_one({
                "session_id": session_id,
            })
        
        if not thread:
            print(f"❌ No thread found for session_id: {session_id}")
            return {
                "status": True,
                "statusCode": 200,
                "data": []
            }
        
        thread_object_id = thread['_id']
        print(f"✅ Found thread: {thread_object_id}")
        
        # Now get dialogs using the thread ObjectId
        dialogs_collection = mongo_db["dialogs"]
        cursor = dialogs_collection.find({
            "thread_id": ObjectId(thread_object_id)
        }).sort("timestamp", 1)
        
        dialogs_list = await cursor.to_list(length=None)
        print(f"✅ Found {len(dialogs_list)} dialogs")
        
        formatted_dialogs = []
        for dialog in dialogs_list:
            print(f"  Dialog: type={dialog.get('type')}, message={dialog.get('message', '')[:50]}")
            
            # Get message content from correct field
            content = dialog.get("message") or dialog.get("content") or ""
            
            # Properly handle message types (uppercase in DB)
            msg_type = dialog.get("type", "").upper()
            
            # Map to frontend expected format
            if msg_type == "USER":
                formatted_type = "USER"
            elif msg_type == "HUMAN_AGENT":
                formatted_type = "HUMAN_AGENT"
            elif msg_type == "AI":
                formatted_type = "AI"
            else:
                formatted_type = "AI"  
            
            timestamp = dialog.get("timestamp")
            if timestamp:
                timestamp_str = timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp)
            else:
                timestamp_str = datetime.utcnow().isoformat()
            
            formatted_dialog = {
                "content": content,
                "type": formatted_type, 
                "id": str(dialog.get("_id")),
                "timestamp": timestamp_str
            }
            formatted_dialogs.append(formatted_dialog)
        
        print(f"✅ Returning {len(formatted_dialogs)} formatted dialogs")
        
        response = {
            "status": True,
            "statusCode": 200,
            "data": formatted_dialogs
        }
        return response
        
    except Exception as e:
        print(f"❌ Error getting thread history by session_id: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": False,
            "statusCode": 500,
            "data": [],
            "message": str(e)
        }
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def get_user_threads(user_id: str, company_id: int = None):
    """Get all threads for a specific user"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads_collection = mongo_db["threads"]
        
        # Build query filter
        query_filter = {
            "user_id": int(user_id) if user_id.isdigit() else user_id,
            "app_name": "HELP_SUPPORT",
            "is_deleted": False
        }
        
        if company_id:
            query_filter["company_id"] = company_id
        
        # Get threads, sorted by updated_at descending
        cursor = threads_collection.find(query_filter).sort("updated_at", -1)
        
        threads = []
        async for thread in cursor:
            thread["_id"] = str(thread["_id"])  # Convert ObjectId to string
            threads.append(thread)
        
        return threads
        
    except Exception as e:
        print(f"❌ Error getting user threads: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


def is_mongodb_configured():
    """Check if MongoDB is properly configured"""
    # MongoDB storage disabled by project configuration (no DB storage required)
    return True


def get_mongodb_config():
    """Get MongoDB configuration info"""
    return {
        "configured": is_mongodb_configured(),
        "database_name": MONGO_DB_NAME,
        "uri_set": bool(MONGO_URI)
    }


async def get_help_support_questions(limit: int = 10):
    """Get help support questions from MongoDB"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - cannot fetch questions")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "help_supports"  # Note: using help_support not help_supports

        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        collection = mongo_db[MONGO_COLLECTION]

        # Get questions with limit
        cursor = collection.find({}).limit(limit)
        questions = []
        
        async for doc in cursor:
            question_data = {
                "id": str(doc.get("_id", "")),
                "platform": doc.get("platform", ""),
                "question": doc.get("question", ""),
                "answer": doc.get("answer", "")
            }
            questions.append(question_data)
        
        # Get total count
        total_count = await collection.count_documents({})
        
        print(f"✅ Fetched {len(questions)} questions from help_support collection")
        return {
            "questions": questions,
            "total_count": total_count
        }
        
    except Exception as e:
        print(f"❌ Error fetching help support questions: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def get_user_last_thread(user_id: str, company_id: int = None):
    """Get the last thread for a specific user"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads_collection = mongo_db["threads"]
        
        # Build query filter
        query_filter = {
            "user_id": int(user_id) if user_id.isdigit() else user_id,
            "app_name": "HELP_SUPPORT",  # Updated to match your current app_name
            "is_deleted": False
        }
        
        if company_id:
            query_filter["company_id"] = company_id
        
        # Get the most recent thread only (limit 1)
        thread = await threads_collection.find_one(
            query_filter, 
            sort=[("updated_at", -1)]
        )
        
        if thread:
            thread["_id"] = str(thread["_id"])  # Convert ObjectId to string
            return thread
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting user's last thread: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def check_existing_ticket_for_thread(thread_id: str):
    """Check if there's an active ticket for this thread"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db["support_tickets"]
        
        # Look for active ticket (not resolved) for this thread
        ticket = await tickets_collection.find_one({
            "thread_id": thread_id,
            "ticket_status": {"$in": ["open", "assigned", "in_progress"]}  # Not resolved
        })
        
        if ticket:
            print(f"📌 Found active ticket {ticket['ticket_id']} for thread {thread_id}")
            return {
                "ticket_id": ticket.get("ticket_id"),
                "ticket_status": ticket.get("ticket_status"),
                "assigned_to_name": ticket.get("assigned_to_name", "Support Team")
            }
        
        return None
        
    except Exception as e:
        print(f"❌ Error checking existing ticket: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def store_user_message_to_ticket(thread_id: str, user_message: str, user_id: str):
    """Store user's message as part of the ticket conversation"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return False
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        
        # Store in dialogs collection with ticket context
        dialogs_collection = mongo_db["dialogs"]
        
        # Find thread ObjectId
        threads_collection = mongo_db["threads"]
        thread = await threads_collection.find_one({
            "state.thread_id": thread_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if thread:
            thread_object_id = thread['_id']
            
            message_data = {
                "thread_id": thread_object_id,
                "type": "USER",
                "message": user_message,
                "timestamp": datetime.now(),
                "sender_id": user_id,
                "awaiting_agent_response": True  # Flag for agent dashboard
            }
            
            await dialogs_collection.insert_one(message_data)
            
            # Set agent notification when user sends message
            tickets_collection = mongo_db["support_tickets"]
            await tickets_collection.update_one(
                {"thread_id": thread_id},
                {"$set": {"has_agent_notification": True, "has_user_notification": False}}
            )
            
            print(f"✅ User message stored for ticket thread: {thread_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error storing user message to ticket: {e}")
        return False
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def store_agent_response(thread_id: str, agent_message: str, agent_id: str, agent_name: str):
    """Store agent's response message"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return False
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        
        # Store in dialogs collection
        dialogs_collection = mongo_db["dialogs"]
        
        # Find thread ObjectId
        threads_collection = mongo_db["threads"]
        thread = await threads_collection.find_one({
            "state.thread_id": thread_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if thread:
            thread_object_id = thread['_id']
            
            message_data = {
                "thread_id": thread_object_id,
                "type": "HUMAN_AGENT",
                "message": agent_message,
                "timestamp": datetime.now(),
                "sender_id": agent_id,
                "sender_name": agent_name,
                "awaiting_user_response": True  # Flag that agent responded
            }
            
            await dialogs_collection.insert_one(message_data)
            
            # Mark any pending user messages as responded to
            await dialogs_collection.update_many(
                {
                    "thread_id": thread_object_id,
                    "type": "USER",
                    "awaiting_agent_response": True
                },
                {
                    "$set": {"awaiting_agent_response": False}
                }
            )
            
            # Set user notification when agent sends message
            tickets_collection = mongo_db["support_tickets"]
            await tickets_collection.update_one(
                {"thread_id": thread_id},
                {"$set": {"has_user_notification": True, "has_agent_notification": False}}
            )
            
            print(f"✅ Agent response stored for thread: {thread_id}")
            return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error storing agent response: {e}")
        return False
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def get_latest_agent_response(thread_id: str, user_id: str):
    """Get latest agent response that user hasn't seen yet"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return None
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        dialogs_collection = mongo_db["dialogs"]
        
        # Find thread ObjectId
        threads_collection = mongo_db["threads"]
        thread = await threads_collection.find_one({
            "state.thread_id": thread_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if thread:
            thread_object_id = thread['_id']
            
            # Find latest agent response awaiting user
            agent_response = await dialogs_collection.find_one(
                {
                    "thread_id": thread_object_id,
                    "type": "HUMAN_AGENT",
                    "awaiting_user_response": True
                },
                sort=[("timestamp", -1)]  # Latest first
            )
            
            if agent_response:
                # Mark as seen by user
                await dialogs_collection.update_one(
                    {"_id": agent_response["_id"]},
                    {"$set": {"awaiting_user_response": False}}
                )
                
                return {
                    "message": agent_response["message"],
                    "agent_name": agent_response.get("sender_name", "Support Agent"),
                    "timestamp": agent_response["timestamp"].isoformat()
                }
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting latest agent response: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def create_support_ticket(question: str, user_id, company_id: int, thread_id: str = None, first_name: str = None, last_name: str = None):
    """Create a support ticket for unanswered questions with LLM analysis"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - skipping ticket creation")
        return None
    
    mongo_client = None
    try:
        from helpers.ticket_analyzer import analyze_thread_for_ticket, get_fallback_analysis

        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db["support_tickets"]

        # Analyze thread for better ticket summary
        if thread_id:
            try:
                analysis_result = await analyze_thread_for_ticket(thread_id)
            except:
                analysis_result = get_fallback_analysis(question)
        else:
            analysis_result = get_fallback_analysis(question)

        created_at = updated_at = datetime.now()

        ticket_data = {
            "question": question,
            "user_id": int(user_id) if str(user_id).isdigit() else str(user_id),
            "company_id": company_id,
            "ticket_status": "open",
            "thread_id": thread_id,
            "description": analysis_result.get("description", ""),
            "module_name": analysis_result.get("module_name", "General Support"),
            "priority": "",
            "first_name": first_name or "",
            "last_name": last_name or "",
            "created_at": created_at,
            "updated_at": updated_at,
            "ticket_id": str(random.randint(100000, 999999))
        }

        result = await tickets_collection.insert_one(ticket_data)
        return str(result.inserted_id)
    
    except Exception as e:
        print(f"❌ Error creating support ticket: {e}")
        return None
    
    finally:
        if mongo_client:
            mongo_client.close()




async def get_support_tickets(user_id: str = None, company_id: int = None, status: str = None, limit: int = 50):
    """Get support tickets with optional filters"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - cannot fetch tickets")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "support_tickets"

        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db[MONGO_COLLECTION]

        # Build query filter
        query_filter = {}
        
        if user_id:
            # Handle both string and int formats
            if str(user_id).isdigit():
                query_filter["user_id"] = {"$in": [str(user_id), int(user_id)]}
            else:
                query_filter["user_id"] = str(user_id)
        
        if company_id:
            query_filter["company_id"] = company_id
            
        if status:
            query_filter["ticket_status"] = status

        # Get tickets with limit, sorted by created_at descending
        cursor = tickets_collection.find(query_filter).sort("created_at", -1).limit(limit)
        
        tickets = []
        async for ticket in cursor:
            ticket_data = {
                "id": str(ticket["_id"]),
                "question": ticket.get("question", ""),
                "user_id": str(ticket.get("user_id", "")),
                "company_id": ticket.get("company_id", ""),
                "ticket_status": ticket.get("ticket_status", "open"),
                "ticket_id": ticket.get("ticket_id"),
                "thread_id": ticket.get("thread_id"),
                "description": ticket.get("description", ""),
                "module_name": ticket.get("module_name", ""),
                "priority": ticket.get("priority", "medium"),
                "assigned_to_id": ticket.get("assigned_to_id"),
                "assigned_to_name": ticket.get("assigned_to_name"),
                "has_user_notification": ticket.get("has_user_notification", False),
                "has_agent_notification": ticket.get("has_agent_notification", False),
                "first_name": ticket.get("first_name", ""),
                "last_name": ticket.get("last_name", ""),
                "created_at": ticket.get("created_at").isoformat() if ticket.get("created_at") else None,
                "updated_at": ticket.get("updated_at").isoformat() if ticket.get("updated_at") else None
            }
            tickets.append(ticket_data)
        
        # Get total count
        total_count = await tickets_collection.count_documents(query_filter)
        
        print(f"✅ Fetched {len(tickets)} support tickets")
        return {
            "tickets": tickets,
            "total_count": total_count,
            "filters_applied": {
                "user_id": user_id,
                "company_id": company_id,
                "status": status,
                "limit": limit
            }
        }
        
    except Exception as e:
        print(f"❌ Error fetching support tickets: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass

# ============================================================
# FIX FOR mongodb.py - Filter messages after ticket creation
# ============================================================

async def get_ticket_conversation(thread_id: str):
    """Get ONLY User <-> Human Agent messages (after ticket was created)"""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return {"status": True, "data": []}
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        
        # STEP 1: Find the ticket to get creation timestamp
        ticket = await mongo_db["support_tickets"].find_one({"thread_id": thread_id})
        
        if not ticket:
            print(f"❌ No ticket found for thread_id: {thread_id}")
            return {"status": True, "data": []}
        
        ticket_created_at = ticket.get("created_at")
        
        # STEP 2: Find the thread using state.thread_id
        thread = await mongo_db["threads"].find_one({
            "state.thread_id": thread_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if not thread:
            print(f"❌ No thread found for thread_id: {thread_id}")
            return {"status": True, "data": []}
        
        thread_object_id = thread["_id"]
        print(f"✅ Found thread ObjectId: {thread_object_id}")
        
        # STEP 3: Build query to fetch ONLY User + Agent messages AFTER ticket creation
        query = {
            "thread_id": thread_object_id,
            "type": {"$in": ["USER", "HUMAN_AGENT"]}  # Only user and agent messages
        }
        
        # Add timestamp filter if ticket has creation date
        if ticket_created_at:
            query["timestamp"] = {"$gte": ticket_created_at}
        
        cursor = mongo_db["dialogs"].find(query).sort("timestamp", 1)
        
        messages = []
        async for dialog in cursor:
            messages.append({
                "type": dialog.get("type"),
                "content": dialog.get("message", ""),
                "timestamp": dialog.get("timestamp").isoformat() if dialog.get("timestamp") else None
            })
        
        print(f"✅ Found {len(messages)} ticket conversation messages")
        return {"status": True, "data": messages}
        
    except Exception as e:
        print(f"❌ Error fetching ticket conversation: {e}")
        return {"status": True, "data": []}
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def track_user_dissatisfaction(session_id: str, is_dissatisfied: bool):
    """Track user dissatisfaction in the thread state"""
    if not MONGO_URI or not MONGO_URI.strip():
        return None

    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads_collection = mongo_db["threads"]

        # FIXED QUERY (matches your DB schema)
        thread = await threads_collection.find_one({
            "state.thread_id": session_id,
            "app_name": "HELP_SUPPORT"
        })

        # If no thread -> treat as FIRST dissatisfaction (apology)
        if not thread:
            print("Track dissatisfaction: thread not found, treating as first dissatisfaction")
            return 1

        current_state = thread.get("state", {})
        dissatisfaction_count = current_state.get("dissatisfaction_count", 0)

        print(
            f"[TRACK] session={session_id} prev={dissatisfaction_count}, "
            f"dissatisfied={is_dissatisfied}"
        )

        if is_dissatisfied:
            dissatisfaction_count += 1

        # Update thread
        await threads_collection.update_one(
            {"_id": thread["_id"]},
            {
                "$set": {
                    "state.dissatisfaction_count": dissatisfaction_count,
                    "updated_at": datetime.now()
                }
            }
        )

        return dissatisfaction_count

    except Exception as e:
        print(f"[TRACK ERROR] {e}")
        return 1  # fail-safe → treating it as first dissatisfaction

    finally:
        if mongo_client:
            mongo_client.close()


async def get_dissatisfaction_count(session_id: str):
    """Get current dissatisfaction count for a session (thread_id)."""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return 0
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        threads = mongo_db["threads"]
        
        # Look up document using nested state.thread_id
        thread = await threads.find_one({
            "state.thread_id": session_id,
            "app_name": "HELP_SUPPORT"
        })
        
        if thread and "state" in thread:
            thread.get("state", {}).get("dissatisfaction_count")
        
        return 0
        
    except Exception as e:
        print(f"Error getting dissatisfaction count: {e}")
        return 0
    finally:
        if mongo_client:
            mongo_client.close()

async def get_satisfaction_count(session_id: str):
    """Get current satisfaction count for a session (thread_id)."""
    if not MONGO_URI or MONGO_URI.strip() == "":
        return 0
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        db = mongo_client[MONGO_DB_NAME]
        threads = db["threads"]

        thread = await threads.find_one({
            "state.thread_id": session_id,
            "app_name": "HELP_SUPPORT"
        })

        if thread and "state" in thread:
            return thread["state"].get("satisfaction_count", 0)

        return 0

    except Exception as e:
        print(f"Error getting satisfaction count: {e}")
        return 0

    finally:
        if mongo_client:
            mongo_client.close()


def generate_support_response(dissatisfaction_count: int, ticket_created: bool) -> str:
    """Generate empathetic support response based on dissatisfaction level"""
    
    if dissatisfaction_count == 1:
        return """I understand that my previous response wasn't quite what you were looking for, and I apologize for that. Let me try to help you in a different way.

Could you please help me understand:
- What specific aspect of your issue wasn't addressed?
- What outcome are you trying to achieve?
- Are there any additional details that might help me provide better assistance?

I'm here to support you and want to make sure you get the help you need. Please feel free to rephrase your question or provide more context, and I'll do my best to give you a more helpful response."""

    elif dissatisfaction_count >= 2:
        base_response = """I sincerely apologize that I haven't been able to provide the assistance you need despite multiple attempts. I understand how frustrating this must be for you, and I want to ensure you get proper support.

I've escalated your concern to our specialized support team who will be better equipped to handle your specific situation."""

        if ticket_created:
            base_response += """ A support ticket has been created, and a human support specialist will review your case and reach out to you directly with personalized assistance.

In the meantime, here are a few alternative ways you might find help:
- Check our comprehensive help documentation for step-by-step guides
- Try rephrasing your question with more specific details about your situation
- Contact our support team directly if you need immediate assistance

Thank you for your patience, and I'm confident our support team will be able to resolve your issue promptly."""
        else:
            base_response += """ Please consider reaching out to our human support team directly, as they may be able to provide more specialized assistance for your particular situation.

I apologize again for not being able to resolve your issue, and I appreciate your patience."""

        return base_response
    
    else:
        return "I'm here to help! Please let me know what specific assistance you need, and I'll do my best to provide helpful information."


async def get_admin_tickets(
    user_id: str = None,
    ticket_name: str = None, 
    ticket_id: str = None,
    ticket_status: str = None,
    priority: str = None,
    assigned_to_name: str = None,  
    page: int = 1,
    page_size: int = 10
):

    """Get tickets for admin with filtering and pagination"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - cannot fetch tickets")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "support_tickets"
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db[MONGO_COLLECTION]

        # Build query filter
        query_filter = {}
        
        if user_id:
            query_filter["user_id"] = int(user_id)
        
        if ticket_name and ticket_name.strip():
            # Search in question, description, or module_name
            query_filter["$or"] = [
                {"question": {"$regex": ticket_name, "$options": "i"}},
                {"description": {"$regex": ticket_name, "$options": "i"}},
                {"module_name": {"$regex": ticket_name, "$options": "i"}},
                {"ticket_id": {"$regex": ticket_name, "$options": "i"}},
                {"user_id": {"$regex": ticket_name, "$options": "i"}},
                {"first_name": {"$regex": ticket_name, "$options": "i"}},
                {"last_name": {"$regex": ticket_name, "$options": "i"}}
            ]
            
        if ticket_id:
            query_filter["ticket_id"] = ticket_id
            
        if ticket_status:
            query_filter["ticket_status"] = ticket_status
            
        if priority and priority.strip():
            query_filter["priority"] = priority.strip()
            
        if assigned_to_name and assigned_to_name.strip():
            query_filter["assigned_to_name"] = assigned_to_name.strip()


        # Get total counts for all tickets (unfiltered)
        total_tickets = await tickets_collection.count_documents({})
        total_open = await tickets_collection.count_documents({"ticket_status": "open"})
        total_in_progress = await tickets_collection.count_documents({"ticket_status": "in_progress"})
        total_resolved = await tickets_collection.count_documents({"ticket_status": "closed"})

        # Get filtered tickets with pagination
        skip = (page - 1) * page_size
        cursor = tickets_collection.find(query_filter).sort("created_at", -1).skip(skip).limit(page_size)
        
        tickets = []
        async for ticket in cursor:
            ticket_data = {
                "id": str(ticket["_id"]),
                "question": ticket.get("question", ""),
                "user_id": str(ticket.get("user_id", "")),
                "company_id": ticket.get("company_id", ""),
                "ticket_status": ticket.get("ticket_status", "open"),
                "ticket_id": ticket.get("ticket_id"),
                "thread_id": ticket.get("thread_id"),
                "description": ticket.get("description", ""),
                "module_name": ticket.get("module_name", ""),
                "priority": ticket.get("priority",""),
                "assigned_to_id": ticket.get("assigned_to_id"),
                "assigned_to_name": ticket.get("assigned_to_name"),
                "first_name": ticket.get("first_name", ""),
                "last_name": ticket.get("last_name", ""),
                "has_user_notification": ticket.get("has_user_notification", False),
                "has_agent_notification": ticket.get("has_agent_notification", False),
                "created_at": ticket.get("created_at").isoformat() if ticket.get("created_at") else None,
                "updated_at": ticket.get("updated_at").isoformat() if ticket.get("updated_at") else None
            }
            tickets.append(ticket_data)
        
        # Get total count of filtered results
        filtered_total_count = await tickets_collection.count_documents(query_filter)
        total_pages = (filtered_total_count + page_size - 1) // page_size
        
        print(f"✅ Fetched {len(tickets)} admin support tickets (page {page} of {total_pages})")
        
        return {
            "ticket_counts": {
                "total_tickets": total_tickets,
                "total_open": total_open,
                "total_in_progress": total_in_progress,
                "total_resolved": total_resolved
            },
            "tickets": tickets,
            "pagination": {
                "current_page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "total_items": filtered_total_count,
                "has_next": page < total_pages,
                "has_prev": page > 1
            },
            "filters_applied": {
                "user_id": user_id,
                "ticket_name": ticket_name,
                "ticket_id": ticket_id,
                "ticket_status": ticket_status,
                "priority": priority
            }
        }
        
    except Exception as e:
        print(f"❌ Error fetching admin support tickets: {e}")
        return None
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def update_ticket_assignment(
    ticket_id: str,
    priority: str = None,
    assigned_to_id: str = None,
    assigned_to_name: str = None
):
    """Update ticket priority and assignment - Admin only"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - cannot update ticket")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "support_tickets"
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db[MONGO_COLLECTION]

        # Build update fields
        update_fields = {"updated_at": datetime.now()}
        
        if priority:
            if priority not in ["low", "medium", "high", "urgent"]:
                return {"error": "Invalid priority. Must be one of: low, medium, high, urgent"}
            update_fields["priority"] = priority
        
        if assigned_to_id:
            update_fields["assigned_to_id"] = assigned_to_id
            
        if assigned_to_name:
            update_fields["assigned_to_name"] = assigned_to_name

        if len(update_fields) == 1:  # Only updated_at was added
            return {"error": "No fields to update provided"}

        # Update the ticket
        result = await tickets_collection.update_one(
            {"ticket_id": ticket_id},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            return {"error": "Ticket not found"}
        
        if result.modified_count == 0:
            return {"error": "No changes made to ticket"}
        
        # Fetch the updated ticket
        updated_ticket = await tickets_collection.find_one({"ticket_id": ticket_id})
        
        if updated_ticket:
            ticket_data = {
                "id": str(updated_ticket["_id"]),
                "ticket_id": updated_ticket.get("ticket_id"),
                "priority": updated_ticket.get("priority"),
                "assigned_to_id": updated_ticket.get("assigned_to_id"),
                "assigned_to_name": updated_ticket.get("assigned_to_name"),
                "updated_at": updated_ticket.get("updated_at").isoformat() if updated_ticket.get("updated_at") else None
            }
            
            print(f"✅ Ticket {ticket_id} updated successfully")
            return {"ticket": ticket_data}
        
        return {"error": "Failed to fetch updated ticket"}
        
    except Exception as e:
        print(f"❌ Error updating ticket assignment: {e}")
        return {"error": str(e)}
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass


async def update_ticket_status(ticket_id: str, action: str):
    """Update ticket status with proper workflow transitions - Admin only"""
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        print("⚠️ MongoDB URI not configured - cannot update ticket status")
        return None
    
    mongo_client = None
    try:
        MONGO_COLLECTION = "support_tickets"
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db[MONGO_COLLECTION]

        # Validate action
        if action not in ["in_progress", "close"]:
            return {"error": "Invalid action. Must be 'in_progress' or 'close'"}

        # First, get the current ticket to check its status
        current_ticket = await tickets_collection.find_one({"ticket_id": ticket_id})
        
        if not current_ticket:
            return {"error": "Ticket not found"}
        
        current_status = current_ticket.get("ticket_status", "open")
        
        # Define status transitions
        if action == "in_progress":
            if current_status != "open":
                return {"error": f"Cannot start progress. Ticket status is '{current_status}', expected 'open'"}
            new_status = "in_progress"
            action_message = "moved to in progress"
            
        elif action == "close":
            if current_status != "in_progress":
                return {"error": f"Cannot close ticket. Ticket status is '{current_status}', expected 'in_progress'"}
            new_status = "closed"
            action_message = "closed"

        # Update the ticket status
        update_fields = {
            "ticket_status": new_status,
            "updated_at": datetime.now()
        }
        
        result = await tickets_collection.update_one(
            {"ticket_id": ticket_id},
            {"$set": update_fields}
        )
        
        if result.modified_count == 0:
            return {"error": "Failed to update ticket status"}
        
        # Fetch the updated ticket
        updated_ticket = await tickets_collection.find_one({"ticket_id": ticket_id})
        
        if updated_ticket:
            ticket_data = {
                "id": str(updated_ticket["_id"]),
                "ticket_id": updated_ticket.get("ticket_id"),
                "ticket_status": updated_ticket.get("ticket_status"),
                "previous_status": current_status,
                "updated_at": updated_ticket.get("updated_at").isoformat() if updated_ticket.get("updated_at") else None
            }
            
            print(f"✅ Ticket {ticket_id} {action_message} successfully")
            return {"ticket": ticket_data, "message": f"Ticket {action_message} successfully"}
        
        return {"error": "Failed to fetch updated ticket"}
        
    except Exception as e:
        print(f"❌ Error updating ticket status: {e}")
        return {"error": str(e)}
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass

async def migrate_missing_ticket_ids():
    """Add ticket_ids to existing tickets that have None - RUN ONCE"""
    import random
    from motor.motor_asyncio import AsyncIOMotorClient
    from datetime import datetime
    
    if not MONGO_URI or MONGO_URI.strip() == "":
        return {"error": "MongoDB not configured"}
    
    mongo_client = None
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI)
        mongo_db = mongo_client[MONGO_DB_NAME]
        tickets_collection = mongo_db["support_tickets"]
        
        # Find tickets without ticket_id or with None
        cursor = tickets_collection.find({
            "$or": [
                {"ticket_id": None},
                {"ticket_id": {"$exists": False}}
            ]
        })
        
        updated_count = 0
        tickets_list = await cursor.to_list(length=None)
        
        print(f"🔍 Found {len(tickets_list)} tickets without ticket_id")
        
        for ticket in tickets_list:
            new_ticket_id = str(random.randint(100000, 999999))
            
            # Make sure ticket_id is unique
            while True:
                existing = await tickets_collection.find_one({"ticket_id": new_ticket_id})
                if not existing:
                    break
                new_ticket_id = str(random.randint(100000, 999999))
            
            await tickets_collection.update_one(
                {"_id": ticket["_id"]},
                {
                    "$set": {
                        "ticket_id": new_ticket_id,
                        "updated_at": datetime.now()
                    }
                }
            )
            updated_count += 1
            print(f"✅ Updated ticket ObjectId {ticket['_id']} → ticket_id: {new_ticket_id}")
        
        return {
            "status": "success",
            "updated_count": updated_count,
            "message": f"Successfully migrated {updated_count} tickets"
        }
        
    except Exception as e:
        print(f"❌ Migration error: {e}")
        return {"error": str(e)}
    finally:
        if mongo_client is not None:
            try:
                mongo_client.close()
            except:
                pass