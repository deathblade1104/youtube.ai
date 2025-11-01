"""Celery tasks for video transcription."""
import logging
from typing import Dict

from celery import Task
from sqlalchemy.orm import Session

from celery_app import celery_app
from common.constants.task_constants import (
    TRANSCRIPTION_TASK_CONFIG,
    calculate_exponential_backoff_delay,
)
from database.base import SessionLocal
from database.models import VideoTranscript, Videos, VideoStatusLog
from database.repository import GenericRepository
from modules.videos.services.video_status_log_service import VideoStatusLogService
from modules.transcription.services.video_transcription_service import VideoTranscriptionService

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
    name="tasks.transcribe_video",
    max_retries=TRANSCRIPTION_TASK_CONFIG["max_retries"],
    # Note: retry delay is calculated dynamically with exponential backoff
    # Setting default_retry_delay for backward compatibility, but will be overridden
    default_retry_delay=TRANSCRIPTION_TASK_CONFIG["initial_retry_delay"],
)
def transcribe_video_task(self, payload: Dict) -> Dict:
    """
    Celery task to transcribe video audio.

    Args:
        payload: Video transcoded event payload containing:
            - id: Event ID
            - videoId: Video ID
            - variants: List of transcoded variants
            - ts: Timestamp

    Returns:
        Dict with transcription information
    """
    task_logger = logger.getChild(f"task_{self.request.id}")
    video_id = payload.get("videoId")
    event_id = payload.get("id")

    task_logger.info(
        f"🎤 Starting video transcription: videoId={video_id}, eventId={event_id}"
    )
    task_logger.info(f"📋 Full payload: {payload}")
    task_logger.info(f"🆔 Task ID: {self.request.id}, Retries: {self.request.retries}")

    try:
        db = self._db or SessionLocal()
        task_logger.info(f"🔌 Database session created for video {video_id}")

        transcript_repo = GenericRepository(VideoTranscript, db)
        transcription_service = VideoTranscriptionService(db, transcript_repo)

        # Check if transcript already exists (idempotency)
        task_logger.info(f"🔍 Checking for existing transcript for video {video_id}...")
        existing_transcript = transcript_repo.find_one({"video_id": video_id})
        if existing_transcript and existing_transcript.status == "ready":
            task_logger.warning(
                f"⏭️ Transcript already exists for video {video_id}, skipping. Transcript ID: {existing_transcript.id}"
            )
            return {
                "videoId": video_id,
                "status": "exists",
                "transcriptId": existing_transcript.id,
            }

        # Get original video S3 key
        original_video_key = f"videos/original/{video_id}.mp4"
        task_logger.info(f"📹 Using video S3 key: {original_video_key}")

        # Process transcription (downloads, transcribes, uploads, saves)
        task_logger.info(f"🚀 Starting transcription service for video {video_id}...")
        result = transcription_service.transcribe_video(
            video_id, original_video_key
        )
        task_logger.info(f"✅ Transcription service completed for video {video_id}: {result}")

        # Note: Event is published via outbox pattern (background job handles publishing)
        task_logger.info(
            f"✅ Video transcription completed: videoId={video_id}, transcriptId={result['transcript_id']}"
        )

        return {
            "videoId": video_id,
            "status": "completed",
            "transcriptId": result["transcript_id"],
        }

    except Exception as e:
        task_logger.error(
            f"❌ Failed to transcribe video {video_id}: {str(e)}",
            exc_info=True,
        )

        max_retries = TRANSCRIPTION_TASK_CONFIG["max_retries"]
        current_retries = self.request.retries

        task_logger.error(
            f"📊 Retry count: {current_retries}/{max_retries}"
        )

        # Update video status to FAILED if all retries exhausted
        try:
            if current_retries >= max_retries - 1:
                db = self._db or SessionLocal()
                videos_repo = GenericRepository(Videos, db)
                video = videos_repo.find_one({"id": video_id})
                if video:
                    videos_repo.update(
                        {"id": video_id},
                        {
                            "status": "failed",
                            "status_message": str(e),
                        },
                    )
                    # Log status change
                    status_log_repo = GenericRepository(VideoStatusLog, db)
                    # VideoStatusLogService already imported at top
                    status_log_service = VideoStatusLogService(db, status_log_repo)
                    status_log_service.log_status_change(
                        video_id,
                        "failed",
                        "python-backend",
                        str(e),
                    )
                    task_logger.error(
                        f"💀 Updated video {video_id} status to FAILED after exhausting retries"
                    )
                if not self._db:
                    db.close()
                # Don't retry if we've exhausted all attempts
                raise
        except Exception as status_error:
            task_logger.warning(f"Failed to update video status: {str(status_error)}")
            # Re-raise original error if status update fails
            raise e

        # Calculate exponential backoff delay (matching BullMQ behavior)
        initial_delay = TRANSCRIPTION_TASK_CONFIG["initial_retry_delay"]
        retry_delay = calculate_exponential_backoff_delay(initial_delay, current_retries)

        task_logger.warning(
            f"🔄 Retrying transcription in {retry_delay}s (exponential backoff: attempt {current_retries + 1}/{max_retries})"
        )

        # Retry the task with exponential backoff
        raise self.retry(exc=e, countdown=retry_delay)
    finally:
        if self._db:
            self._db.close()
            self._db = None

