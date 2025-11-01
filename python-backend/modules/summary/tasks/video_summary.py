"""Celery tasks for video summarization."""
import json
import logging
from typing import Dict

from celery import Task
from sqlalchemy.orm import Session

from celery_app import celery_app
from common.constants.task_constants import (
    SUMMARY_TASK_CONFIG,
    calculate_exponential_backoff_delay,
)
from database.base import SessionLocal
from database.models import VideoSummary, Videos, VideoStatusLog
from database.repository import GenericRepository
from modules.summary.services.video_summary_service import VideoSummaryService
from modules.videos.services.video_status_log_service import VideoStatusLogService

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
    name="tasks.summarize_video",
    max_retries=SUMMARY_TASK_CONFIG["max_retries"],
    # Note: retry delay is calculated dynamically with exponential backoff
    # Setting default_retry_delay for backward compatibility, but will be overridden
    default_retry_delay=SUMMARY_TASK_CONFIG["initial_retry_delay"],
)
def summarize_video_task(self, payload: Dict) -> Dict:
    """
    Celery task to summarize video transcript.

    Args:
        payload: Video transcribed event payload containing:
            - id: Event ID
            - videoId: Video ID
            - transcriptFileKey: S3 key to transcript JSON file
            - snippetCount: Number of transcript segments
            - ts: Timestamp

    Returns:
        Dict with summary information
    """
    task_logger = logger.getChild(f"task_{self.request.id}")
    video_id = payload.get("videoId")
    transcript_file_key = payload.get("transcriptFileKey")
    event_id = payload.get("id")

    task_logger.info(
        f"🎬 Starting video summarization: videoId={video_id}, eventId={event_id}"
    )
    task_logger.info(f"📋 Full payload: {payload}")
    task_logger.info(f"🆔 Task ID: {self.request.id}, Retries: {self.request.retries}")
    task_logger.info(f"📄 Transcript file key: {transcript_file_key}")

    try:
        db = self._db or SessionLocal()
        summary_repo = GenericRepository(VideoSummary, db)
        summary_service = VideoSummaryService(db, summary_repo)

        # Check if summary already exists and is complete (idempotency)
        # VideoSummary doesn't have a status field, so we check if summary_text exists
        existing_summary = summary_repo.find_one({"video_id": video_id})
        if existing_summary and existing_summary.summary_text:
            task_logger.warning(
                f"⏭️ Summary already exists for video {video_id} (complete), skipping"
            )
            return {
                "videoId": video_id,
                "status": "exists",
                "summaryId": existing_summary.id,
            }

        # Process summary (this now saves to DB and adds to outbox in transaction)
        result = summary_service.process_summary(video_id, transcript_file_key)

        # Note: Event is published via outbox pattern (background job handles publishing)
        task_logger.info(
            f"✅ Video summarization completed: videoId={video_id}, summaryId={result['summary_id']}"
        )

        return {
            "videoId": video_id,
            "status": "completed",
            "summaryId": result["summary_id"],
        }

    except Exception as e:
        task_logger.error(
            f"❌ Failed to summarize video {video_id}: {str(e)}",
            exc_info=True,
        )

        max_retries = SUMMARY_TASK_CONFIG["max_retries"]
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
        initial_delay = SUMMARY_TASK_CONFIG["initial_retry_delay"]
        retry_delay = calculate_exponential_backoff_delay(initial_delay, current_retries)

        task_logger.warning(
            f"🔄 Retrying summarization in {retry_delay}s (exponential backoff: attempt {current_retries + 1}/{max_retries})"
        )

        # Retry the task with exponential backoff
        raise self.retry(exc=e, countdown=retry_delay)
    finally:
        if self._db:
            self._db.close()
            self._db = None

