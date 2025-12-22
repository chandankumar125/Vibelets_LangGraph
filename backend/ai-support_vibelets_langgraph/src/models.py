from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class LoginRequest(BaseModel):
    """Request model for user login"""
    username: str = Field(..., description="Username or User ID")
    password: str = Field(..., description="Password")


class LoginResponseData(BaseModel):
    """Data section for login response"""
    token: str = Field(..., description="JWT Token")
    user_id: str = Field(..., description="User ID")
    role: str = Field(..., description="User Role")
    company_id: int = Field(..., description="Company ID")


class LoginResponse(BaseModel):
    """Response model for login"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: Optional[LoginResponseData] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")


class QuestionRequest(BaseModel):
    """Request model for asking questions"""
    question: str = Field(..., min_length=1, max_length=1000, description="The question to ask")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of relevant chunks to retrieve")
    # Required fields for MongoDB integration
    user_id: str = Field(..., min_length=1, description="User ID for session management")
    company_id: int = Field(..., ge=1, description="Company ID for multi-tenant support")
    # Optional field for conversation continuity
    thread_id: Optional[str] = Field(None, description="Thread ID for conversation continuity")
    last_question: Optional[str] = Field(None, description="Last question asked")
    is_dissatisfied: bool = False


# Internal model for RAG service (old format)
class RAGResponse(BaseModel):
    """Internal response model for RAG service"""
    answer: str = Field(..., description="The generated answer")


class QuestionResponseData(BaseModel):
    """Data section of the question response"""
    message: str = Field(..., description="The generated answer/message")
    thread_id: str = Field(..., description="Thread ID for conversation continuity")
    # Optional ticket ID when a ticket is created for unanswered questions
    ticket_id: Optional[str] = Field(None, description="Ticket ID if created for unanswered question")
    # Optional run_id for LangSmith tracing
    run_id: Optional[str] = Field(None, description="LangSmith run ID for observability and feedback")


class QuestionResponse(BaseModel):
    """Response model for question answers matching production format"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: QuestionResponseData = Field(..., description="Response data")


class HelpSupportQuestion(BaseModel):
    """Model for individual help support question"""
    id: str = Field(..., description="Question ID")
    platform: str = Field(..., description="Platform (Facebook, TikTok, etc.)")
    question: str = Field(..., description="The question text")
    answer: str = Field(..., description="The answer text")


class QuestionListResponseData(BaseModel):
    """Data section of the question list response"""
    questions: List[HelpSupportQuestion] = Field(..., description="List of questions")
    total_count: int = Field(..., description="Total number of questions available")


class QuestionListResponse(BaseModel):
    """Response model for question list"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: QuestionListResponseData = Field(..., description="Response data")


class TrainRequest(BaseModel):
    """Request model for training/updating the model"""
    overwrite_existing: bool = Field(default=False, description="Whether to overwrite existing data")


class TrainResponse(BaseModel):
    """Response model for training status"""
    status: str = Field(..., description="Training status")
    message: str = Field(..., description="Detailed message")
    total_chunks: int = Field(..., description="Total number of chunks processed")
    books_processed: List[str] = Field(..., description="List of books processed")


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str = Field(..., description="System status")
    database_status: str = Field(..., description="Database connection status")
    total_chunks: int = Field(..., description="Total chunks in database")
    available_books: List[str] = Field(..., description="Available books")


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


class UserThread(BaseModel):
    """Model for user thread"""
    id: str = Field(..., description="Thread ID", alias="_id")
    title: str = Field(..., description="Thread title")
    user_id: str = Field(..., description="User ID")
    company_id: Optional[int] = Field(None, description="Company ID")
    description: str = Field(..., description="Thread description")
    app_name: str = Field(..., description="App name")
    is_deleted: bool = Field(..., description="Is deleted flag")
    state: Dict[str, Any] = Field(..., description="Thread state")
    created_at: str = Field(..., description="Created timestamp")
    updated_at: str = Field(..., description="Updated timestamp")

    class Config:
        populate_by_name = True


class UserThreadResponseData(BaseModel):
    """Data section of the user thread response"""
    thread: Optional[UserThread] = Field(None, description="User's last thread")


class UserThreadResponse(BaseModel):
    """Response model for user thread"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: UserThreadResponseData = Field(..., description="Response data")


class SupportTicket(BaseModel):
    """Model for support tickets"""
    id: str = Field(..., description="Ticket ID", alias="_id")
    question: Optional[str] = Field(None, description="User's question that couldn't be answered")
    user_id: str = Field(..., description="User ID who asked the question")
    company_id: int = Field(..., description="Company ID")
    ticket_status: str = Field(..., description="Ticket status (open, in_progress, resolved)")
    thread_id: Optional[str] = Field(None, description="Associated thread ID")
    description: Optional[str] = Field(None, description="LLM-generated ticket description")
    module_name: Optional[str] = Field(None, description="Module/category for the ticket")
    priority: Optional[str] = Field("medium", description="Ticket priority (low, medium, high, urgent)")
    first_name: Optional[str] = Field(None, description="User's first name")
    last_name: Optional[str] = Field(None, description="User's last name")
    assigned_to_id: Optional[str] = Field(None, description="ID of assigned support person")
    assigned_to_name: Optional[str] = Field(None, description="Name of assigned support person")
    created_at: str = Field(..., description="Created timestamp")
    updated_at: str = Field(..., description="Updated timestamp")
    ticket_id: str = Field(..., description="Created ticket ID")
    has_user_notification: bool = Field(default=False, description="True if user has unread agent messages")
    has_agent_notification: bool = Field(default=False, description="True if agent has unread user messages")

    class Config:
        populate_by_name = True


class TicketResponse(BaseModel):
    """Response model for ticket operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    ticket_id: str = Field(..., description="Created ticket ID")


class TicketListData(BaseModel):
    """Data section for ticket list response"""
    tickets: List[SupportTicket] = Field(..., description="List of support tickets")
    total_count: int = Field(..., description="Total number of tickets")
    filters_applied: Dict[str, Any] = Field(..., description="Applied filters")


class TicketListResponse(BaseModel):
    """Response model for ticket list operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: Optional[TicketListData] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")


# Admin Models
class TicketCounts(BaseModel):
    """Model for ticket count statistics"""
    total_tickets: int = Field(..., description="Total number of tickets")
    total_open: int = Field(..., description="Total open tickets")
    total_in_progress: int = Field(..., description="Total in-progress tickets")
    total_resolved: int = Field(..., description="Total resolved tickets")


class AdminTicketListData(BaseModel):
    """Data section for admin ticket list response"""
    ticket_counts: TicketCounts = Field(..., description="Ticket count statistics")
    tickets: List[SupportTicket] = Field(..., description="List of support tickets")
    pagination: Dict[str, Any] = Field(..., description="Pagination information")
    filters_applied: Dict[str, Any] = Field(..., description="Applied filters")


class AdminTicketListResponse(BaseModel):
    """Response model for admin ticket list operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: Optional[AdminTicketListData] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")


class TicketAssignmentRequest(BaseModel):
    """Request model for ticket assignment and priority update"""
    ticket_id: str = Field(..., description="Ticket ID to update")
    priority: Optional[str] = Field(None, description="New ticket priority (low, medium, high, urgent)")
    assigned_to_id: Optional[str] = Field(None, description="ID of support person to assign")
    assigned_to_name: Optional[str] = Field(None, description="Name of support person to assign")


class TicketAssignmentResponse(BaseModel):
    """Response model for ticket assignment operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Updated ticket data")


class TicketStatusUpdateRequest(BaseModel):
    """Request model for ticket status updates"""
    ticket_id: str = Field(..., description="Ticket ID to update")
    action: str = Field(..., description="Action to perform: 'in_progress' (open->in_progress) or 'close' (in_progress->closed)")


class TicketStatusUpdateResponse(BaseModel):
    """Response model for ticket status update operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    message: str = Field(..., description="Response message")
    data: Optional[Dict[str, Any]] = Field(None, description="Updated ticket data")


class AdminUser(BaseModel):
    """Model for admin users"""
    id: int = Field(..., description="User ID")
    first_name: Optional[str] = Field(None, description="User's first name")
    last_name: Optional[str] = Field(None, description="User's last name")
    company_id: Optional[int] = Field(None, description="Company ID")
    uuid: Optional[str] = Field(None, description="User's UUID")
    is_admin: bool = Field(..., description="Admin status")


class AdminUserListData(BaseModel):
    """Data section for admin user list response"""
    users: List[AdminUser] = Field(..., description="List of admin users")
    total_count: int = Field(..., description="Total number of admin users")


class AdminUserListResponse(BaseModel):
    """Response model for admin user list operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: Optional[AdminUserListData] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")


class AgentUser(BaseModel):
    """Model for agent users"""
    id: int = Field(..., description="User ID")
    first_name: Optional[str] = Field(None, description="User's first name")
    last_name: Optional[str] = Field(None, description="User's last name")
    company_id: Optional[int] = Field(None, description="Company ID")
    uuid: Optional[str] = Field(None, description="User's UUID")
    is_admin: bool = Field(..., description="Admin status")
    role: str = Field(..., description="User role")


class AgentUserListData(BaseModel):
    """Data section for agent user list response"""
    users: List[AgentUser] = Field(..., description="List of agent users")
    total_count: int = Field(..., description="Total number of agent users")


class AgentUserListResponse(BaseModel):
    """Response model for agent user list operations"""
    statusCode: int = Field(..., description="HTTP status code")
    status: bool = Field(..., description="Success status")
    data: Optional[AgentUserListData] = Field(None, description="Response data")
    message: Optional[str] = Field(None, description="Response message")

class PublicChatRequest(BaseModel):
    """Request model for public chat"""
    email: str = Field(..., description="User's email")
    question: str = Field(..., description="The question to ask")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of relevant chunks to retrieve")
    thread_id: Optional[str] = Field(None, description="Thread ID for conversation continuity")
    is_dissatisfied: bool = Field(default=False, description="True if dissatisfied, False if satisfied")

class FeedbackRequest(BaseModel):
    """Request model for submitting feedback"""
    dialog_id: str = Field(..., description="ID of the dialog/message to feedback on")
    is_satisfied: bool = Field(..., description="True if satisfied, False if dissatisfied")
    run_id: Optional[str] = Field(None, description="LangSmith run ID to link feedback to trace")
