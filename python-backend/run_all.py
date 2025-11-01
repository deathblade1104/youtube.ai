#!/usr/bin/env python3
"""Run all services (FastAPI, Celery, Kafka Consumer) in one process."""
import logging
import multiprocessing
import signal
import sys
import time
from multiprocessing import Process

import uvicorn

from config import get_settings
from kafka_client.consumer import create_consumer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Global flag for graceful shutdown
shutdown_event = multiprocessing.Event()


def run_fastapi():
    """Run FastAPI application."""
    logger.info("🚀 Starting FastAPI application...")
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=settings.port,
            log_level=settings.log_level.lower(),
            access_log=False,  # Reduce noise
        )
    except Exception as e:
        logger.error(f"FastAPI error: {str(e)}")


def run_celery_worker():
    """Run Celery worker."""
    logger.info("🔧 Starting Celery worker...")
    try:
        import subprocess
        import sys

        # Log which tasks should be available
        logger.info("🔍 Checking registered tasks...")
        try:
            from celery_app import celery_app
            registered_tasks = list(celery_app.tasks.keys())
            logger.info(f"📋 Celery app has {len(registered_tasks)} registered tasks: {registered_tasks}")
        except Exception as e:
            logger.warn(f"⚠️ Could not check registered tasks: {str(e)}")

        # Run celery worker as subprocess (non-blocking with Popen)
        # Use sys.executable to ensure we use the same Python interpreter
        logger.info("🚀 Launching Celery worker process...")
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "celery",
                "-A",
                "celery_app",
                "worker",
                "--loglevel=info",
                "--concurrency=2",
                "--without-gossip",
                "--without-mingle",
                "--without-heartbeat",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,  # Enable text mode for easier log reading
        )

        logger.info(f"✅ Celery worker process started with PID: {process.pid}")

        # Stream Celery worker logs to main logger
        def stream_logs(pipe, prefix):
            """Stream subprocess output to logger."""
            try:
                for line in iter(pipe.readline, ''):
                    if line:
                        logger.info(f"[Celery] {line.strip()}")
            except Exception as e:
                logger.error(f"Error streaming Celery logs: {str(e)}")

        # Start log streaming threads
        import threading
        stdout_thread = threading.Thread(
            target=stream_logs, args=(process.stdout, "[Celery-STDOUT]"), daemon=True
        )
        stderr_thread = threading.Thread(
            target=stream_logs, args=(process.stderr, "[Celery-STDERR]"), daemon=True
        )
        stdout_thread.start()
        stderr_thread.start()

        # Wait for process to complete (or be killed)
        process.wait()
    except KeyboardInterrupt:
        logger.info("Celery worker stopped")
    except Exception as e:
        logger.error(f"❌ Celery worker error: {str(e)}")
        import traceback
        traceback.print_exc()


def run_kafka_transcription_consumer():
    """Run Kafka consumer for video.transcoded events (transcription)."""
    logger.info("📨 Starting Kafka transcription consumer...")
    try:
        from tasks.video_transcription import transcribe_video_task

        def handle_video_transcoded(payload):
            """Handler for video.transcoded Kafka events."""
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

        # Create and start consumer for video.transcoded
        logger.info("🔌 Creating Kafka consumer for topic: video.transcoded")
        consumer = create_consumer("video.transcoded", handle_video_transcoded)
        logger.info("✅ Kafka consumer created, starting to consume...")
        consumer.consume()
    except Exception as e:
        logger.error(f"❌ Kafka transcription consumer error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()


def run_kafka_summary_consumer():
    """Run Kafka consumer for video.transcribed events (summarization)."""
    logger.info("📨 Starting Kafka summary consumer...")
    try:
        from tasks.video_summary import summarize_video_task

        def handle_video_transcribed(payload):
            """Handler for video.transcribed Kafka events."""
            event_id = payload.get("id")
            video_id = payload.get("videoId")

            logger.info(
                f"📥 Received video.transcribed event: eventId={event_id}, videoId={video_id}"
            )

            try:
                # Queue Celery task
                task_result = summarize_video_task.delay(payload)
                logger.info(
                    f"✅ Queued summarization task: videoId={video_id}, taskId={task_result.id}"
                )
            except Exception as e:
                logger.error(
                    f"❌ Failed to queue summarization task for video {video_id}: {str(e)}"
                )

        # Create and start consumer for video.transcribed
        consumer = create_consumer("video.transcribed", handle_video_transcribed)
        consumer.consume()
    except Exception as e:
        logger.error(f"Kafka summary consumer error: {str(e)}")
        import traceback
        traceback.print_exc()


def signal_handler(signum, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {signum}, shutting down all services...")
    shutdown_event.set()
    sys.exit(0)


def main():
    """Main entry point to run all services."""
    logger.info("=" * 60)
    logger.info("🚀 Starting YouTube AI Python Backend - All Services")
    logger.info("=" * 60)
    logger.info(f"📊 Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else 'N/A'}")
    logger.info(f"📨 Kafka: {settings.kafka_brokers}")
    logger.info(f"🔗 Redis: {settings.redis_host}:{settings.redis_port}")
    logger.info("=" * 60)

    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    processes = []

    try:
        # Start FastAPI
        fastapi_process = Process(target=run_fastapi, name="FastAPI")
        fastapi_process.start()
        processes.append(fastapi_process)
        time.sleep(2)  # Give FastAPI time to start

        # Start Celery worker
        celery_process = Process(target=run_celery_worker, name="Celery")
        celery_process.start()
        processes.append(celery_process)
        time.sleep(2)  # Give Celery time to start

        # Start Kafka transcription consumer (video.transcoded -> transcription)
        kafka_transcription_process = Process(
            target=run_kafka_transcription_consumer, name="KafkaTranscription"
        )
        kafka_transcription_process.start()
        processes.append(kafka_transcription_process)
        time.sleep(1)

        # Start Kafka summary consumer (video.transcribed -> summarization)
        kafka_summary_process = Process(
            target=run_kafka_summary_consumer, name="KafkaSummary"
        )
        kafka_summary_process.start()
        processes.append(kafka_summary_process)
        time.sleep(1)

        # Note: Outbox events are published by nest-be's scheduler (shared table)

        logger.info("✅ All services started successfully!")
        logger.info("📝 FastAPI: http://localhost:{}".format(settings.port))
        logger.info("🔧 Celery worker: Running")
        logger.info("📨 Kafka transcription consumer: Listening for video.transcoded events")
        logger.info("📨 Kafka summary consumer: Listening for video.transcribed events")
        logger.info("📮 Outbox events: Will be published by nest-be scheduler")
        logger.info("Press Ctrl+C to stop all services")

        # Wait for all processes
        for process in processes:
            process.join()

    except KeyboardInterrupt:
        logger.info("\n🛑 Shutting down all services...")
    except Exception as e:
        logger.error(f"❌ Error running services: {str(e)}")
    finally:
        # Terminate all processes
        for process in processes:
            if process.is_alive():
                logger.info(f"Terminating {process.name}...")
                process.terminate()
                process.join(timeout=5)
                if process.is_alive():
                    logger.warning(f"Force killing {process.name}...")
                    process.kill()

        logger.info("👋 All services stopped")


if __name__ == "__main__":
    # Ensure multiprocessing works on all platforms
    multiprocessing.set_start_method("spawn", force=True)
    main()

