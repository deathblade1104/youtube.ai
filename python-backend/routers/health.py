"""Health check endpoints."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.base import SessionLocal, engine

router = APIRouter(prefix="/api/v1/health", tags=["Health"])


def get_db():
    """Dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
async def health_check(db: Session = Depends(get_db)):
    """Comprehensive health check."""
    status = {
        "status": "ok",
        "checks": {},
    }

    # Database check
    try:
        db.execute(text("SELECT 1"))
        status["checks"]["database"] = {"status": "up"}
    except Exception as e:
        status["checks"]["database"] = {"status": "down", "error": str(e)}
        status["status"] = "degraded"

    # Redis check (via engine pool)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        status["checks"]["connection_pool"] = {"status": "up"}
    except Exception as e:
        status["checks"]["connection_pool"] = {"status": "down", "error": str(e)}
        status["status"] = "degraded"

    return JSONResponse(status)


@router.get("/live")
async def liveness():
    """Liveness probe."""
    return JSONResponse({"status": "alive"})


@router.get("/ready")
async def readiness(db: Session = Depends(get_db)):
    """Readiness probe."""
    try:
        db.execute(text("SELECT 1"))
        return JSONResponse({"status": "ready"})
    except Exception:
        return JSONResponse({"status": "not ready"}, status_code=503)

