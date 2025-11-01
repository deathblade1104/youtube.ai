"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from config import get_settings
from database.base import Base, engine
from database.models import (
    OutboxEvent,
    ProcessedMessage,
    Videos,
    VideoStatusLog,
    VideoSummary,
    VideoTranscript,
)  # Import all models to register with Base
from modules.health.routers import health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("🚀 Starting YouTube AI Python Backend")
    logger.info(f"📊 Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'N/A'}")
    logger.info(f"📨 Kafka: {settings.kafka_brokers}")

    # Enable uuid-ossp extension (needed for UUID generation)
    try:
        with engine.begin() as conn:
            # Try to enable extension in the specified schema first
            try:
                conn.execute(text(f'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA {settings.db_schema}'))
                logger.info(f"✅ UUID extension enabled in schema: {settings.db_schema}")
            except Exception:
                # If schema-specific fails, try in public schema
                conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
                logger.info("✅ UUID extension enabled in public schema")
    except Exception as e:
        # If extension already exists or permission denied, that's okay
        if "already exists" in str(e).lower():
            logger.info("ℹ️ UUID extension already exists")
        else:
            logger.warning(f"⚠️ Could not enable UUID extension: {str(e)}. Ensure it's enabled manually.")

    # Synchronize database schema (create/update tables)
    if settings.db_sync:
        logger.info("🔄 Database synchronization enabled - creating/updating tables...")
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("✅ Database tables synchronized")
    else:
        logger.info("⏭️  Database synchronization disabled")

    yield

    # Shutdown
    logger.info("👋 Shutting down YouTube AI Python Backend")


# Create FastAPI app
app = FastAPI(
    title="YouTube AI Python Backend",
    description="Video summarization service with Kafka and Celery",
    version="1.0.0",
    lifespan=lifespan,
)

# Include routers
app.include_router(health.router, tags=["Health"])


@app.get("/")
async def root():
    """Root endpoint."""
    return JSONResponse(
        {
            "message": "YouTube AI Python Backend",
            "version": "1.0.0",
            "status": "running",
        }
    )


@app.get("/api/v1")
async def api_root():
    """API root endpoint."""
    return JSONResponse(
        {
            "message": "YouTube AI Python Backend API",
            "version": "1.0.0",
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=not settings.is_production,
        log_level=settings.log_level.lower(),
    )

