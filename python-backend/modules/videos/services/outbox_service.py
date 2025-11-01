"""Outbox service for reliable Kafka event publishing."""
import logging
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from database.models import OutboxEvent
from database.repository import GenericRepository

logger = logging.getLogger(__name__)


class OutboxService:
    """Service for managing outbox events (similar to nest-be OutboxService)."""

    def __init__(self, db_session: Session):
        """Initialize outbox service."""
        self.db_session = db_session
        self.outbox_repo = GenericRepository(OutboxEvent, db_session)

    def add_to_outbox(
        self,
        topic: str,
        payload: Dict[str, Any],
        db_session: Optional[Session] = None,
        service: str = "python-backend",
    ) -> OutboxEvent:
        """
        Add event to outbox in the same transaction as the main operation.
        This ensures events are persisted even if Kafka is down.

        Note: Events are published by nest-be's outbox scheduler (shared table).

        Args:
            topic: Kafka topic name
            payload: Event payload
            db_session: Optional database session (for transactions)
            service: Service name (default: 'python-backend')

        Returns:
            Created OutboxEvent
        """
        # Use provided session or default - optimize by reusing repo when possible
        if db_session and db_session is not self.db_session:
            # Different session for transaction, create new repo
            repo = GenericRepository(OutboxEvent, db_session)
        else:
            # Same session, reuse existing repo
            repo = self.outbox_repo

        event = repo.create(
            {
                "topic": topic,
                "payload": payload,
                "published": False,
                "attempts": 0,
                "service": service,  # Mark which service created this event
            }
        )

        logger.debug(f"📝 Added event to outbox: topic={topic}, service={service}, id={event.id}")
        return event

    def get_unpublished_events(self, limit: int = 100) -> list[OutboxEvent]:
        """
        Get unpublished events (for background publisher).

        Args:
            limit: Maximum number of events to retrieve

        Returns:
            List of unpublished OutboxEvent instances
        """
        return self.outbox_repo.find_all(
            where={"published": False}, limit=limit, order_by="created_at ASC"
        )

    def mark_as_published(
        self, event_id: UUID, db_session: Optional[Session] = None
    ) -> None:
        """
        Mark event as published.

        Args:
            event_id: OutboxEvent ID
            db_session: Optional database session (for transactions)
        """
        from datetime import datetime

        # Use provided session or default - optimize by reusing repo when possible
        if db_session and db_session is not self.db_session:
            repo = GenericRepository(OutboxEvent, db_session)
        else:
            repo = self.outbox_repo

        event = repo.find_one({"id": str(event_id)})
        if event:
            repo.update(
                {"id": str(event_id)},
                {
                    "published": True,
                    "published_at": datetime.utcnow(),
                },
            )
            logger.debug(f"✅ Marked outbox event as published: id={event_id}")

    def increment_attempts(self, event_id: UUID) -> None:
        """
        Increment attempts counter for failed publishing.

        Args:
            event_id: OutboxEvent ID
        """
        # Optimize: Update directly without fetching first (if DB supports it)
        event = self.outbox_repo.find_one({"id": str(event_id)})
        if event:
            new_attempts = (event.attempts or 0) + 1
            self.outbox_repo.update(
                {"id": str(event_id)},
                {"attempts": new_attempts},
            )
            logger.debug(
                f"📊 Incremented attempts for outbox event: id={event_id}, attempts={new_attempts}"
            )

