"""Common Kafka event handler utilities."""
import logging
from contextlib import contextmanager
from typing import Callable, Dict, List, Optional, Tuple

from database.base import SessionLocal
from modules.videos.services.processed_message_service import ProcessedMessageService

logger = logging.getLogger(__name__)


@contextmanager
def db_session_context():
    """Context manager for database sessions."""
    db_session = SessionLocal()
    try:
        yield db_session
        db_session.commit()
    except Exception:
        db_session.rollback()
        raise
    finally:
        db_session.close()


def validate_kafka_payload(payload: Dict, required_fields: List[str]) -> Tuple[Optional[str], Optional[int]]:
    """
    Validate Kafka event payload and extract common fields.

    Args:
        payload: Event payload dictionary
        required_fields: List of required field names (e.g., ['videoId'])

    Returns:
        Tuple of (event_id, video_id) or (None, None) if validation fails

    Raises:
        ValueError: If validation fails
    """
    # Extract event ID (from outbox or payload)
    event_id = payload.get("eventId") or payload.get("id")

    # Validate required fields
    missing_fields = [field for field in required_fields if not payload.get(field)]
    if missing_fields:
        logger.error(f"❌ Invalid payload: missing fields {missing_fields}. Payload: {payload}")
        return None, None

    if not event_id:
        logger.error(f"❌ Invalid payload: missing eventId/id. Payload: {payload}")
        return None, None

    video_id = payload.get("videoId") if "videoId" in required_fields else None

    return event_id, video_id


def handle_kafka_event_with_idempotency(
    payload: Dict,
    topic_name: str,
    task_func: Callable,
    task_name: str,
) -> None:
    """
    Common handler logic for Kafka events with idempotency checking.

    Args:
        payload: Event payload
        topic_name: Kafka topic name for idempotency tracking
        task_func: Celery task function to call
        task_name: Name of the task (for logging)
    """
    # Validate payload and extract common fields
    event_id, video_id = validate_kafka_payload(payload, ["videoId"])
    if not event_id or video_id is None:
        return

    logger.info(
        f"📥 Received {topic_name} event: eventId={event_id}, videoId={video_id}"
    )

    # Use context manager for database session
    with db_session_context() as db_session:
        processed_service = ProcessedMessageService(db_session)

        # Fast check: skip if already processed
        if processed_service.is_processed(event_id, topic_name):
            logger.warning(
                f"⏭️ Skipping duplicate message: eventId={event_id}, videoId={video_id}"
            )
            return

        # Queue Celery task immediately (non-blocking)
        logger.info(f"🔄 Queuing {task_name} task for video {video_id}...")
        task_result = task_func.delay(payload)

        # Mark as processed (best-effort, skip duplicate check since we already verified)
        try:
            processed_service.mark_as_processed(event_id, topic_name, skip_check=True)
            logger.debug(
                f"✅ Marked event as processed: eventId={event_id}, videoId={video_id}"
            )
        except Exception as mark_error:
            # Non-critical: task will handle idempotency via DB constraints
            logger.warning(
                f"⚠️ Failed to mark event as processed (non-critical, task will handle idempotency): {str(mark_error)}"
            )
            # Session already rolled back by context manager

        logger.info(
            f"✅ Queued {task_name} task: videoId={video_id}, taskId={task_result.id}"
        )

