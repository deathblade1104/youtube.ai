"""Database models for video transcripts and summaries.

Note: Indexes and constraints are created by NestJS TypeORM synchronize.
Python backend only defines the model structure without indexes.
"""
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    JSON,
    Text,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from typing import Optional

from database.base import BaseEntity


class Videos(BaseEntity):
    """Video model (shared with nest-be).

    Note: Indexes are created by NestJS TypeORM synchronize, not here.
    """

    __tablename__ = "videos"

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    user_id = Column(Integer, nullable=False)
    user_name = Column(Text, nullable=False)
    key = Column(Text, nullable=False)
    status = Column(Text, default="pending", nullable=False)  # VideoProcessingStatus enum
    status_message = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Indexes are created by NestJS TypeORM, not Python backend


class VideoStatusLog(BaseEntity):
    """Video status log model (shared with nest-be).

    Tracks all status changes for videos, capturing who/what made the change.

    Note: Indexes are created by NestJS TypeORM synchronize, not here.
    """

    __tablename__ = "video_status_logs"

    video_id = Column(Integer, nullable=False)
    status = Column(Text, nullable=False)  # VideoProcessingStatus enum
    actor = Column(Text, default="system", nullable=False)  # 'system', service name, or user ID
    status_message = Column(Text, nullable=True)  # Optional message/context

    # Indexes are created by NestJS TypeORM, not Python backend


class VideoTranscript(BaseEntity):
    """Video transcript model.

    Note: Unique constraint and indexes are created by NestJS TypeORM synchronize, not here.
    """

    __tablename__ = "video_transcripts"

    video_id = Column(Integer, nullable=False, unique=True)
    transcript_text = Column(Text, nullable=True)
    transcript_path = Column(Text, nullable=True)
    status = Column(Text, default="processing", nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    model_info = Column(JSON, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Unique constraint and indexes are created by NestJS TypeORM, not Python backend


class VideoSummary(BaseEntity):
    """Video summary model.

    Note: Unique constraint and indexes are created by NestJS TypeORM synchronize, not here.
    """

    __tablename__ = "video_summaries"

    video_id = Column(Integer, nullable=False, unique=True)
    summary_text = Column(Text, nullable=True)
    summary_path = Column(Text, nullable=True)
    model_info = Column(JSON, nullable=True)
    quality_score = Column(Float, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Unique constraint and indexes are created by NestJS TypeORM, not Python backend


class OutboxEvent(BaseEntity):
    """Outbox event model for reliable Kafka publishing (shared with nest-be).

    Note: Indexes are created by NestJS TypeORM synchronize, not here.
    """

    __tablename__ = "outbox_events"

    # Override id from BaseEntity to use UUID
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    topic = Column(Text, nullable=False)
    payload = Column(JSON, nullable=False)
    published = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    service = Column(Text, nullable=True)  # Service name (e.g., 'python-backend', 'nest-be')
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    published_at = Column(DateTime(timezone=True), nullable=True)

    # Indexes are created by NestJS TypeORM, not Python backend
