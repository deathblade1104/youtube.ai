#!/usr/bin/env python3
"""Script to run the FastAPI application."""
import uvicorn

from config import get_settings

settings = get_settings()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=not settings.is_production,
        log_level=settings.log_level.lower(),
    )

