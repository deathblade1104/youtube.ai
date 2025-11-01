"""Celery application configuration."""
import logging

from celery import Celery

from config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "youtube_ai",
    broker=settings.celery_broker_url_resolved,
    backend=settings.celery_result_backend_resolved,
)

# Import tasks to ensure they're registered
# This is required for Celery to discover and register the tasks
try:
    import modules.summary.tasks.video_summary  # noqa: F401
    import modules.transcription.tasks.video_transcription  # noqa: F401
    logger.info("✅ Successfully imported all task modules")
except ImportError as e:
    logger.error(f"❌ Failed to import task modules: {str(e)}")
    raise

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Log registered tasks for debugging
# Filter out built-in Celery tasks
user_tasks = [t for t in celery_app.tasks.keys() if not t.startswith("celery.")]
logger.info(f"✅ Celery app initialized with {len(user_tasks)} user-defined tasks")
logger.info(f"📋 Registered user tasks: {user_tasks}")

if not user_tasks:
    logger.warning("⚠️ No user tasks registered! Check task imports.")

