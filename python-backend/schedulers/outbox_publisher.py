"""Scheduler to poll outbox and queue publishing tasks."""
import logging
import time
from typing import List

from celery import group

from database.base import SessionLocal
from database.models import OutboxEvent
from services.outbox_service import OutboxService
from tasks.outbox_publisher import publish_outbox_event_task

logger = logging.getLogger(__name__)


class OutboxPublisherScheduler:
    """Scheduler that polls outbox for unpublished events and queues publishing tasks."""

    def __init__(self, poll_interval: int = 5):
        """
        Initialize outbox publisher scheduler.

        Args:
            poll_interval: Polling interval in seconds (default: 5)
        """
        self.poll_interval = poll_interval
        self.running = False

    def poll_and_publish(self):
        """
        Poll outbox for unpublished events and queue them for publishing.
        This should be called periodically (via cron or background thread).
        """
        db = SessionLocal()
        try:
            outbox_service = OutboxService(db)

            # Get unpublished events
            unpublished_events = outbox_service.get_unpublished_events(limit=100)

            if not unpublished_events:
                logger.debug("No unpublished outbox events found")
                return

            logger.info(
                f"📬 Found {len(unpublished_events)} unpublished outbox events"
            )

            # Queue Celery tasks for each event
            # Use group to process them in parallel
            tasks = [
                publish_outbox_event_task.s(str(event.id)) for event in unpublished_events
            ]
            job = group(*tasks)
            result = job.apply_async()

            logger.info(
                f"✅ Queued {len(unpublished_events)} outbox events for publishing"
            )

        except Exception as e:
            logger.error(f"❌ Error polling outbox events: {str(e)}")
        finally:
            db.close()

    def run_forever(self):
        """Run scheduler in a loop (for background thread)."""
        self.running = True
        logger.info(
            f"🚀 Starting outbox publisher scheduler (poll interval: {self.poll_interval}s)"
        )

        while self.running:
            try:
                self.poll_and_publish()
                time.sleep(self.poll_interval)
            except KeyboardInterrupt:
                logger.info("Shutting down outbox publisher scheduler...")
                self.running = False
                break
            except Exception as e:
                logger.error(f"❌ Scheduler error: {str(e)}")
                time.sleep(self.poll_interval)

    def stop(self):
        """Stop the scheduler."""
        self.running = False


# Singleton instance
_scheduler: OutboxPublisherScheduler = None


def get_scheduler() -> OutboxPublisherScheduler:
    """Get or create scheduler singleton."""
    global _scheduler
    if _scheduler is None:
        _scheduler = OutboxPublisherScheduler(poll_interval=5)
    return _scheduler

