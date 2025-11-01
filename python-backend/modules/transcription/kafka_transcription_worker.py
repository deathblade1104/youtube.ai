"""Kafka consumer worker that processes video.transcoded events for transcription."""
import logging
import sys
from typing import Dict

from common.handlers.kafka import validate_kafka_payload, db_session_context
from database.models import VideoTranscript
from database.repository import GenericRepository
from modules.transcription.tasks.video_transcription import transcribe_video_task
from modules.videos.services.processed_message_service import ProcessedMessageService
from providers.kafka import create_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Topic name for idempotency tracking
TOPIC_NAME = "video.transcoded"


def handle_video_transcoded(payload: Dict):
    """
    Handler for video.transcoded Kafka events.

    This handler checks real idempotency (transcript exists) before skipping.
    If transcript doesn't exist, it processes even if event was marked as processed
    (handles stuck states where task failed but event was marked).

    Args:
        payload: Event payload containing:
            - id: Event ID (from outbox)
            - eventId: Alternative event ID (same as id)
            - videoId: Video ID
            - variants: List of transcoded variants
            - ts: Timestamp
    """
    # Validate payload and extract common fields
    event_id, video_id = validate_kafka_payload(payload, ["videoId"])
    if not event_id or video_id is None:
        return

    logger.info(
        f"📥 Received {TOPIC_NAME} event: eventId={event_id}, videoId={video_id}"
    )

    # Log variants count for debugging
    variants = payload.get("variants", [])
    if variants:
        logger.debug(f"Event has {len(variants)} variants")

    # Use context manager for database session
    with db_session_context() as db_session:
        transcript_repo = GenericRepository(VideoTranscript, db_session)
        processed_service = ProcessedMessageService(db_session)

        # Real idempotency check: does transcript exist with status "ready"?
        existing_transcript = transcript_repo.find_one({"video_id": video_id})
        if existing_transcript and existing_transcript.status == "ready":
            logger.info(
                f"✅ Transcript already exists for video {video_id} (status: {existing_transcript.status}), skipping"
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
            # Event was processed but transcript doesn't exist - likely task failed
            logger.warning(
                f"⚠️ Event {event_id} was marked as processed but transcript doesn't exist for video {video_id}. "
                f"Allowing reprocessing to fix stuck state..."
            )

        # Queue Celery task immediately (non-blocking)
        logger.info(f"🔄 Queuing transcription task for video {video_id}...")
        task_result = transcribe_video_task.delay(payload)

        # Mark as processed (best-effort, skip duplicate check since we already verified transcript)
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
            f"✅ Queued transcription task: videoId={video_id}, taskId={task_result.id}"
        )


def main():
    """Main entry point for Kafka consumer worker."""
    logger.info("🚀 Starting Kafka consumer worker for video.transcoded events")

    # Create consumer for video.transcoded topic
    consumer = create_consumer("video.transcoded", handle_video_transcoded)

    try:
        # Start consuming
        consumer.consume()
    except KeyboardInterrupt:
        logger.info("Shutting down Kafka consumer...")
        consumer.close()
        sys.exit(0)


if __name__ == "__main__":
    main()

