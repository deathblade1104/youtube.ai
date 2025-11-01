"""Celery task for publishing outbox events to Kafka."""
import logging
from uuid import UUID

from celery import Task
from sqlalchemy.orm import Session

from celery_app import celery_app
from database.base import SessionLocal
from database.models import OutboxEvent
from database.repository import GenericRepository
from kafka_client.producer import get_kafka_producer
from services.outbox_service import OutboxService

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Custom task base class that handles database session."""

    def __init__(self):
        """Initialize task."""
        super().__init__()
        self._db = None

    def before_start(self, task_id, args, kwargs):
        """Called before task starts."""
        self._db = SessionLocal()

    def after_return(self, *args, **kwargs):
        """Called after task returns."""
        if self._db:
            self._db.close()
            self._db = None


@celery_app.task(
    bind=True,
    base=DatabaseTask,
    name="tasks.publish_outbox_event",
    max_retries=5,
    default_retry_delay=30,
)
def publish_outbox_event_task(self, event_id: str) -> dict:
    """
    Celery task to publish an outbox event to Kafka.

    Args:
        event_id: OutboxEvent UUID as string

    Returns:
        Dict with publishing result
    """
    task_logger = logger.getChild(f"task_{self.request.id}")

    try:
        db = self._db or SessionLocal()
        outbox_repo = GenericRepository(OutboxEvent, db)
        outbox_service = OutboxService(db)

        # Get outbox event
        event = outbox_repo.find_one({"id": event_id})
        if not event:
            task_logger.error(f"❌ Outbox event not found: {event_id}")
            return {"status": "error", "message": "Event not found"}

        if event.published:
            task_logger.info(f"⏭️ Event already published: {event_id}")
            return {"status": "skipped", "message": "Already published"}

        # Publish to Kafka
        kafka_producer = get_kafka_producer()
        success = kafka_producer.publish(
            topic=event.topic,
            payload={
                **event.payload,
                "eventId": str(event.id),  # Include event ID for idempotency
            },
        )

        if success:
            # Mark as published
            outbox_service.mark_as_published(UUID(event_id), db_session=db)
            task_logger.info(
                f"✅ Published outbox event to Kafka: topic={event.topic}, eventId={event_id}"
            )
            return {"status": "success", "topic": event.topic, "eventId": event_id}
        else:
            # Increment attempts
            outbox_service.increment_attempts(UUID(event_id))
            raise Exception("Failed to publish to Kafka")

    except Exception as e:
        task_logger.error(f"❌ Failed to publish outbox event {event_id}: {str(e)}")
        # Retry the task
        raise self.retry(exc=e)
    finally:
        if self._db:
            self._db.close()
            self._db = None

