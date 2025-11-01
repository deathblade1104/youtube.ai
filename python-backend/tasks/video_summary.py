"""Celery tasks for video summarization."""
import json
import logging
from typing import Dict

from celery import Task
from sqlalchemy.orm import Session

from celery_app import celery_app
from database.base import SessionLocal
from database.models import VideoSummary, Videos, VideoStatusLog
from database.repository import GenericRepository
from services.video_summary_service import VideoSummaryService
from services.video_status_log_service import VideoStatusLogService

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
    max_retries=3,
    default_retry_delay=60,
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

    try:
        db = self._db or SessionLocal()
        summary_repo = GenericRepository(VideoSummary, db)
        summary_service = VideoSummaryService(db, summary_repo)

        # Check if summary already exists (idempotency)
        existing_summary = summary_repo.find_one({"video_id": video_id})
        if existing_summary:
            task_logger.warn(
                f"⏭️ Summary already exists for video {video_id}, skipping"
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
        task_logger.error(f"❌ Failed to summarize video {video_id}: {str(e)}")

        # Update video status to FAILED if all retries exhausted
        try:
            if self.request.retries >= (self.max_retries or 3) - 1:
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
        except Exception as status_error:
            task_logger.warn(f"Failed to update video status: {str(status_error)}")

        # Retry the task
        raise self.retry(exc=e)
    finally:
        if self._db:
            self._db.close()
            self._db = None

