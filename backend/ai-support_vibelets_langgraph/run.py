#!/usr/bin/env python3
"""
RAG System Runner
Run the FastAPI server with proper configuration
"""

import uvicorn
import os
import platform
from src.config import settings

if __name__ == "__main__":
    # Handle Windows networking issues
    host = settings.host
    
    # Check for HOST environment variable override
    if "HOST" in os.environ:
        host = os.environ["HOST"]
        print(f"Using HOST environment variable: {host}")
    
    # Handle platform-specific networking
    if platform.system() == "Windows":
        # On Windows, force localhost for any non-local addresses to avoid binding errors
        if host in ["0.0.0.0", "::", "localhost"]:
            host = "127.0.0.1"
            print(f"Windows detected: Using {host}")
        elif not host.startswith("127.0.0.1") and not host.startswith("localhost"):
            # External IP detected, use localhost instead
            print(f"Windows detected: External IP {host} not bindable locally, using 127.0.0.1")
            host = "127.0.0.1"
    else:
        # On Linux/Unix systems, use 0.0.0.0 to bind to all interfaces (required for Docker)
        if host in ["127.0.0.1", "localhost"] or not host.startswith("0.0.0.0"):
            # For any specific IP addresses (including external IPs), use 0.0.0.0 to bind to all interfaces
            if host not in ["127.0.0.1", "localhost", "0.0.0.0"]:
                print(f"Linux/Unix detected: Cannot bind directly to external IP {host}, using 0.0.0.0 to accept all connections")
            else:
                print(f"Linux/Unix detected: Using 0.0.0.0 to bind to all interfaces")
            host = "0.0.0.0"
    
    print(f"Starting server on {host}:{settings.port}")
    
    try:
        uvicorn.run(
            "src.main:app",
            host=host,
            port=settings.port,
            reload=settings.debug,
            log_level="info",
            workers=1  # Keep it single worker for ChromaDB compatibility
        )
    except OSError as e:
        if "10049" in str(e) or "Cannot assign requested address" in str(e) or "99" in str(e):
            print(f"Network error with {host}: {e}")
            print("Trying to bind to 0.0.0.0 (all interfaces)...")
            uvicorn.run(
                "src.main:app",
                host="0.0.0.0",
                port=settings.port,
                reload=settings.debug,
                log_level="info",
                workers=1
            )
        else:
            raise