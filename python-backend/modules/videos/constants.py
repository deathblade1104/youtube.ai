"""Constants for videos module."""
from common.constants.kafka import KAFKA_TOPIC_VIDEO_TRANSCRIBED

# Celery task names
CELERY_TASK_TRANSCRIBE_VIDEO = "tasks.transcribe_video"
CELERY_TASK_SUMMARIZE_VIDEO = "tasks.summarize_video"

# Video processing statuses
VIDEO_STATUS_PROCESSING = "processing"
VIDEO_STATUS_TRANSCRIBING = "transcribing"
VIDEO_STATUS_SUMMARIZING = "summarizing"
VIDEO_STATUS_COMPLETED = "completed"
VIDEO_STATUS_FAILED = "failed"

