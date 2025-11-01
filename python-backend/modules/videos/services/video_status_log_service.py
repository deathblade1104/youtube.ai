"""Video status log service for tracking status changes."""
import logging
from typing import Optional


from database.models import VideoStatusLog
from database.repository import GenericRepository

logger = logging.getLogger(__name__)


class VideoStatusLogService:
    """Service for logging video status changes."""

    def __init__(self, db_session, status_log_repo: GenericRepository[VideoStatusLog]):
        """Initialize video status log service."""
        self.db_session = db_session
        self.status_log_repo = status_log_repo

    def log_status_change(
        self,
        video_id: int,
        status: str,
        actor: str = "system",
        status_message: Optional[str] = None,
    ) -> Optional[VideoStatusLog]:
        """
        Log a video status change.
        Only logs if the status is different from the last logged status.

        Args:
            video_id: Video ID
            status: New status (VideoProcessingStatus enum value)
            actor: Who/what made the change ('system', 'python-backend', or user ID like 'user-123')
            status_message: Optional message/context

        Returns:
            VideoStatusLog record if logged, None if skipped (duplicate status)
        """
        try:
            # Check the most recent status log for this video
            # Optimize: Use repository method with limit=1 instead of raw query
            all_logs = self.status_log_repo.find_all(
                where={"video_id": video_id},
                limit=1,
                order_by="created_at DESC",
            )
            latest_log = all_logs[0] if all_logs else None

            # Only log if:
            # 1. No previous status exists (first log), OR
            # 2. The new status is different from the latest status
            if latest_log and latest_log.status == status:
                logger.debug(
                    f"⏭️ Skipping duplicate status log: videoId={video_id}, status={status} (same as latest)"
                )
                return None  # Return None to indicate no log was created

            log_entry = self.status_log_repo.create(
                {
                    "video_id": video_id,
                    "status": status,
                    "actor": actor,
                    "status_message": status_message,
                }
            )
            logger.debug(
                f"📝 Logged status change: videoId={video_id}, status={status}, actor={actor}"
            )
            return log_entry
        except Exception as e:
            # Don't fail the main operation if logging fails
            logger.warning(
                f"Failed to log status change for video {video_id}: {str(e)}"
            )
            # Don't re-raise - allow caller to continue
            return None

    def get_status_history(self, video_id: int) -> list[VideoStatusLog]:
        """Get status history for a video."""
        return self.status_log_repo.find_all({"video_id": video_id}, order_by="created_at DESC")

