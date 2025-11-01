"""Kafka consumer worker that processes video.transcoded events for transcription."""
import logging
import signal
import sys
from typing import Dict

from kafka_client.consumer import create_consumer
from tasks.video_transcription import transcribe_video_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def handle_video_transcoded(payload: Dict):
    """
    Handler for video.transcoded Kafka events.

    Args:
        payload: Event payload containing:
            - id: Event ID
            - videoId: Video ID
            - variants: List of transcoded variants
            - ts: Timestamp
    """
    event_id = payload.get("id")
    video_id = payload.get("videoId")
    variants = payload.get("variants", [])

    logger.info(
        f"📥 Received video.transcoded event: eventId={event_id}, videoId={video_id}, variants={len(variants)}"
    )
    logger.debug(f"Full payload: {payload}")

    if not video_id:
        logger.error(f"❌ Invalid payload: missing videoId. Payload: {payload}")
        return

    try:
        # Queue Celery task for transcription
        logger.info(f"🔄 Queuing transcription task for video {video_id}...")
        task_result = transcribe_video_task.delay(payload)
        logger.info(
            f"✅ Queued transcription task: videoId={video_id}, taskId={task_result.id}, taskState={task_result.state}"
        )
    except Exception as e:
        logger.error(
            f"❌ Failed to queue transcription task for video {video_id}: {str(e)}",
            exc_info=True,
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

