"""Kafka consumer worker that processes video.transcribed events."""
import logging
import sys
from typing import Dict

from common.handlers.kafka import validate_kafka_payload, db_session_context
from database.models import VideoSummary
from database.repository import GenericRepository
from modules.summary.tasks.video_summary import summarize_video_task
from modules.videos.services.processed_message_service import ProcessedMessageService
from providers.kafka import create_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Topic name for idempotency tracking
TOPIC_NAME = "video.transcribed"


def handle_video_transcribed(payload: Dict):
    """
    Handler for video.transcribed Kafka events.

    This handler checks real idempotency (summary exists) before skipping.
    If summary doesn't exist, it processes even if event was marked as processed
    (handles stuck states where task failed but event was marked).

    Args:
        payload: Event payload containing:
            - id: Event ID (from outbox)
            - eventId: Alternative event ID (same as id)
            - videoId: Video ID
            - transcriptFileKey: S3 key to transcript JSON
            - snippetCount: Number of segments
            - ts: Timestamp
    """
    # Validate payload and extract common fields
    event_id, video_id = validate_kafka_payload(payload, ["videoId"])
    if not event_id or video_id is None:
        return

    logger.info(
        f"📥 Received {TOPIC_NAME} event: eventId={event_id}, videoId={video_id}"
    )

    # Use context manager for database session
    with db_session_context() as db_session:
        summary_repo = GenericRepository(VideoSummary, db_session)
        processed_service = ProcessedMessageService(db_session)

        # Real idempotency check: does summary exist and is it complete?
        # VideoSummary doesn't have a status field, so we check if summary_text exists
        existing_summary = summary_repo.find_one({"video_id": video_id})
        if existing_summary and existing_summary.summary_text:
            logger.info(
                f"✅ Summary already exists for video {video_id} (complete), skipping"
            )
            # Still mark event as processed if not already marked (for tracking)
            if not processed_service.is_processed(event_id, TOPIC_NAME):
                try:
                    processed_service.mark_as_processed(event_id, TOPIC_NAME, skip_check=True)
                except Exception:
                    pass  # Non-critical
            return

        # Check if event was marked as processed
        was_processed = processed_service.is_processed(event_id, TOPIC_NAME)
        if was_processed:
            # Event was processed but summary doesn't exist - likely task failed
            logger.warning(
                f"⚠️ Event {event_id} was marked as processed but summary doesn't exist for video {video_id}. "
                f"Allowing reprocessing to fix stuck state..."
            )

        # Queue Celery task immediately (non-blocking)
        logger.info(f"🔄 Queuing summarization task for video {video_id}...")
        task_result = summarize_video_task.delay(payload)

        # Mark as processed (best-effort, skip duplicate check since we already verified summary)
        try:
            processed_service.mark_as_processed(event_id, TOPIC_NAME, skip_check=True)
            logger.debug(
                f"✅ Marked event as processed: eventId={event_id}, videoId={video_id}"
            )
        except Exception as mark_error:
            # Non-critical: task will handle idempotency via DB constraints
            logger.warning(
                f"⚠️ Failed to mark event as processed (non-critical, task will handle idempotency): {str(mark_error)}"
            )

        logger.info(
            f"✅ Queued summarization task: videoId={video_id}, taskId={task_result.id}"
        )


def main():
    """Main entry point for Kafka consumer worker."""
    logger.info("🚀 Starting Kafka consumer worker for video.transcribed events")

    # Create consumer for video.transcribed topic
    consumer = create_consumer("video.transcribed", handle_video_transcribed)

    try:
        # Start consuming
        consumer.consume()
    except KeyboardInterrupt:
        logger.info("Shutting down Kafka consumer...")
        consumer.close()
        sys.exit(0)


if __name__ == "__main__":
    main()

