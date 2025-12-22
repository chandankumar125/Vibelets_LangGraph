from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from typing import Dict, Any
from db.pg import query

JWT_SECRET = os.getenv("JWT_SECRET", "5O2PPu6vbk2XK9A")


# For use as a dependency in route handlers
async def authorize_user(request: Request) -> Dict[str, Any]:
    """
    Authorization dependency that validates JWT token and returns user context
    """
    try:
        if request.method == "OPTIONS":
            return Response(status_code=200)
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        print("Authorization header: ", auth_header)
        # Check if Authorization header exists and is properly formatted
        if not auth_header:
            raise HTTPException(
                status_code=401,
                detail={"status": False, "message": "Authorization header is missing"},
            )

        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail={
                    "status": False,
                    "message": "Invalid authorization header format. Expected: 'Bearer <token>'",
                },
            )

        token = auth_header.split(" ")[1]

        try:
            # Decode and verify the token
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

            # Add user info to request state
            request.state.user_id = payload.get("user_id")
            request.state.company_id = payload.get("company_id")
            request.state.token = token
            request.state.role = payload.get("role")      
            request.state.is_agent = payload.get("is_agent", False)  
            request.state.is_admin = payload.get("is_admin", False)  
            request.state.first_name = payload.get("first_name")
            request.state.last_name = payload.get("last_name")

            # Return user context
            return {
                "user_id": payload.get("user_id"),
                "company_id": payload.get("company_id"),
                "email": payload.get("email"),
                "role": payload.get("role"),
            }

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail={"status": False, "message": "Token has expired"},
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=401,
                detail={"status": False, "message": f"Invalid token: {str(e)}"},
            )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"status": False, "message": f"Authorization error: {str(e)}"},
        )


async def authorize(request: Request, call_next):
    # Skip authorization for health check, docs, login & public chat
    if request.url.path in [
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/",
        "/login",
        "/public/ask",
        "/public/ask/stream",
    ]:
        return await call_next(request)


    try:
        # Get token
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"status": False, "message": "Authorization header is missing"},
            )

        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"status": False, "message": "Invalid token format. Expected 'Bearer <token>'"},
            )

        token = auth_header.split(" ")[1].strip()

        if not token:
            return JSONResponse(
                status_code=401,
                content={"status": False, "message": "Token not provided"},
            )

       # Decode JWT Token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401, content={"status": False, "message": "Token expired"}
            )
        except jwt.InvalidTokenError:
            return JSONResponse(
                status_code=401, content={"status": False, "message": "Invalid token"}
            )

        # UUID must be present
        if not payload.get("uuid"):
            return JSONResponse(
                status_code=401,
                content={"status": False, "message": "Invalid token: missing UUID"},
            )

       
        try:
            pgQuery = """
                SELECT id, company_id, is_admin, first_name, last_name, role
                FROM adu_users
                WHERE uuid = %s
            """
            pgRes = query(pgQuery, (payload.get("uuid"),))
        except Exception as db_err:
            return JSONResponse(
                status_code=500,
                content={"status": False, "message": f"Database error: {db_err}"},
            )

        # User not found
        if not pgRes:
            return JSONResponse(
                status_code=401,
                content={"status": False, "message": "User not found"},
            )

        user_data = pgRes[0]

        # Attach user context to request.state
        request.state.user_id = user_data["id"]
        request.state.company_id = user_data["company_id"]
        request.state.first_name = user_data["first_name"]
        request.state.last_name = user_data["last_name"]
        request.state.token = token

        # Role assignment
        role = user_data.get("role")
        request.state.role = role
        request.state.is_admin = (role == "admin")
        request.state.is_agent = (role == "agent")

        # Continue to next handler
        return await call_next(request)

    except Exception as e:
        print(f"Unexpected error in authorization: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": False, "message": "Internal server error"},
        )
