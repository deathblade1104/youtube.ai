"""Service for tracking processed Kafka messages (idempotency)."""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from database.models import ProcessedMessage
from database.repository import GenericRepository

logger = logging.getLogger(__name__)


class ProcessedMessageService:
    """Service for managing processed messages (idempotency tracking)."""

    def __init__(self, db_session: Session):
        """Initialize processed message service."""
        self.db_session = db_session
        self.processed_repo = GenericRepository(ProcessedMessage, db_session)

    def is_processed(self, event_id: str, topic: Optional[str] = None) -> bool:
        """
        Check if an event has already been processed.

        Args:
            event_id: Event ID (UUID string)
            topic: Optional topic name for additional validation

        Returns:
            True if event has been processed, False otherwise
        """
        try:
            message = self.processed_repo.find_one({"id": str(event_id)})
            if message:
                if topic and message.topic != topic:
                    logger.warning(
                        f"⚠️ Event {event_id} found but topic mismatch: expected={topic}, found={message.topic}"
                    )
                return True
            return False
        except Exception as e:
            logger.error(f"❌ Error checking processed message {event_id}: {str(e)}")
            # On error, assume not processed (fail open to avoid blocking)
            return False

    def mark_as_processed(self, event_id: str, topic: str, skip_check: bool = False) -> ProcessedMessage:
        """
        Mark an event as processed.

        Args:
            event_id: Event ID (UUID string)
            topic: Topic name
            skip_check: Skip duplicate check if already verified (optimization)

        Returns:
            Created ProcessedMessage
        """
        try:
            # Skip check if already verified by caller (optimization)
            if not skip_check:
                existing = self.processed_repo.find_one({"id": str(event_id)})
                if existing:
                    logger.debug(
                        f"⏭️ Event {event_id} already marked as processed (race condition handled)"
                    )
                    return existing

            message = self.processed_repo.create(
                {
                    "id": str(event_id),
                    "topic": topic,
                }
            )
            logger.debug(
                f"✅ Marked event as processed: eventId={event_id}, topic={topic}"
            )
            return message
        except Exception as e:
            # Handle unique constraint violation (race condition)
            if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
                logger.debug(
                    f"⏭️ Event {event_id} already marked (race condition during insert)"
                )
                # Return existing record
                return self.processed_repo.find_one({"id": str(event_id)})

            logger.error(
                f"❌ Failed to mark event as processed {event_id}: {str(e)}", exc_info=True
            )
            raise

