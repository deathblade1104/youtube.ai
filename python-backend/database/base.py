"""Base database models and session management."""
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, Integer, create_engine
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func

from config import get_settings

settings = get_settings()

# Create database engine with schema support
# Set search_path to use the specified schema
connect_args = {}
if settings.db_schema:
    # Set the search_path to use the specified schema
    connect_args["options"] = f"-csearch_path={settings.db_schema}"

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.log_level == "DEBUG",
    connect_args=connect_args,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


class BaseEntity(Base):
    """Abstract base entity with common fields."""

    __abstract__ = True

    # Note: Subclasses can override id (e.g., OutboxEvent uses UUID)
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
        server_default=func.now(),
    )

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name."""
        return cls.__name__.lower()


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

