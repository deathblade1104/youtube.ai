"""Kafka consumer worker that processes video.transcribed events."""
import logging
import signal
import sys
from typing import Dict

from kafka_client.consumer import create_consumer
from tasks.video_summary import summarize_video_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def handle_video_transcribed(payload: Dict):
    """
    Handler for video.transcribed Kafka events.

    Args:
        payload: Event payload containing:
            - id: Event ID
            - videoId: Video ID
            - transcriptFileKey: S3 key to transcript JSON
            - snippetCount: Number of segments
            - ts: Timestamp
    """
    event_id = payload.get("id")
    video_id = payload.get("videoId")

    logger.info(
        f"📥 Received video.transcribed event: eventId={event_id}, videoId={video_id}"
    )

    try:
        # Queue Celery task (similar to BullMQ in nest-be)
        task_result = summarize_video_task.delay(payload)
        logger.info(
            f"✅ Queued summarization task: videoId={video_id}, taskId={task_result.id}"
        )
    except Exception as e:
        logger.error(
            f"❌ Failed to queue summarization task for video {video_id}: {str(e)}"
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

