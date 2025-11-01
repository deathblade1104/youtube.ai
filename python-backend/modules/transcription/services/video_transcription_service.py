"""Video transcription service using OpenAI Whisper."""
import json
import logging
import os
import tempfile
from typing import Any, Dict, Optional

import boto3
import whisper
from botocore.exceptions import ClientError

from config import get_settings
from database.models import VideoStatusLog, VideoTranscript, Videos
from database.repository import GenericRepository
from modules.videos.services.outbox_service import OutboxService
from modules.videos.services.video_status_log_service import VideoStatusLogService

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize S3 client (lazy initialization)
_s3_client = None


def get_s3_client():
    """Get or create S3 client singleton."""
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            endpoint_url=settings.aws_s3_endpoint if settings.use_localstack else None,
        )
    return _s3_client


class VideoTranscriptionService:
    """Service for transcribing videos using OpenAI Whisper."""

    def __init__(self, db_session, transcript_repo: GenericRepository[VideoTranscript], outbox_service: Optional[OutboxService] = None):
        """Initialize video transcription service."""
        self.db_session = db_session
        self.transcript_repo = transcript_repo
        self.outbox_service = outbox_service or OutboxService(db_session)
        self.bucket = settings.aws_youtube_bucket

        # Initialize Whisper model (lazy loading)
        self._model = None
        self.model_name = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium, large

        # Initialize status log service
        status_log_repo = GenericRepository(VideoStatusLog, db_session)
        self.status_log_service = VideoStatusLogService(db_session, status_log_repo)

    @property
    def model(self):
        """Lazy load Whisper model."""
        if self._model is None:
            logger.info(f"📥 Loading Whisper model: {self.model_name}")
            self._model = whisper.load_model(self.model_name)
            logger.info(f"✅ Whisper model loaded: {self.model_name}")
        return self._model

    def transcribe_video(self, video_id: int, video_s3_key: str) -> Dict[str, Any]:
        """
        Transcribe video: download from S3, transcribe with Whisper, save to DB and S3.

        Args:
            video_id: Video ID
            video_s3_key: S3 key to video file

        Returns:
            Dict with transcript_id, transcript_file_key, segment_count
        """
        logger.info(
            f"🎤 Starting transcription for video {video_id}: {video_s3_key}"
        )

        temp_video_path = None
        temp_audio_path = None

        try:
            # 1. Update video status to TRANSCRIBING if not already set
            logger.info(f"🔍 Step 0: Checking video status for video {video_id}...")
            videos_repo = GenericRepository(Videos, self.db_session)
            video = videos_repo.find_one({"id": video_id})

            if not video:
                error_msg = f"Video {video_id} not found in database"
                logger.error(f"❌ {error_msg}")
                raise ValueError(error_msg)

            logger.info(f"📊 Video {video_id} found - Title: '{video.title}', Current status: {video.status}")

            if video and video.status != "transcribing":
                logger.info(f"🔄 Updating video {video_id} status to 'transcribing'...")
                videos_repo.update(
                    {"id": video_id},
                    {"status": "transcribing"},
                )
                # Log status change
                self.status_log_service.log_status_change(
                    video_id,
                    "transcribing",
                    "python-backend",
                    "Starting transcription with OpenAI Whisper",
                )
                logger.info(f"✅ Video {video_id} status updated to 'transcribing'")
            else:
                logger.info(f"ℹ️ Video {video_id} already in 'transcribing' status, continuing...")

            # 2. Download video from S3 to temp file
            logger.info(f"📥 Step 1: Downloading video from S3: {video_s3_key}")
            temp_video_path = self._download_video_from_s3(video_s3_key, video_id)
            logger.info(f"✅ Video downloaded: {temp_video_path}")

            # 3. Extract audio from video (Whisper needs audio)
            logger.info(f"🎵 Step 2: Extracting audio from video...")
            temp_audio_path = self._extract_audio(temp_video_path, video_id)
            logger.info(f"✅ Audio extracted: {temp_audio_path}")

            # 4. Transcribe using OpenAI Whisper
            logger.info(f"🤖 Step 3: Running Whisper transcription on {temp_audio_path}")
            logger.info(f"📋 Using Whisper model: {self.model_name}")
            logger.info(f"⏱️ Starting transcription - this may take a while for large videos...")
            try:
                result = self.model.transcribe(temp_audio_path)
                logger.info(f"✅ Whisper transcription completed successfully")
                logger.info(f"📊 Transcription stats: duration={result.get('duration', 0):.2f}s, language={result.get('language', 'unknown')}")
            except Exception as whisper_error:
                logger.error(f"❌ Whisper transcription failed: {str(whisper_error)}", exc_info=True)
                raise

            # 5. Process transcript segments
            transcript_text = result.get("text", "").strip()
            segments = result.get("segments", [])
            segment_count = len(segments)

            logger.info(
                f"✅ Transcription completed: {segment_count} segments, {len(transcript_text)} chars"
            )
            logger.info(f"📝 Transcript preview: {transcript_text[:200]}..." if transcript_text else "⚠️ Empty transcript")

            # 6. Upload transcript to S3
            logger.info(f"☁️ Step 4: Uploading transcript to S3...")
            transcript_file_key = self._upload_transcript_to_s3(
                video_id, transcript_text, segments
            )
            logger.info(f"✅ Transcript uploaded to S3: {transcript_file_key}")

            # 7. Save transcript to database and add to outbox in transaction
            logger.info(f"💾 Step 5: Saving transcript to database and adding to outbox...")
            transcript_record = self._save_transcript_with_outbox(
                video_id, transcript_text, transcript_file_key, segment_count, result
            )
            logger.info(f"✅ Transcript saved to database (ID: {transcript_record.id})")

            # 8. Update video status to SUMMARIZING (next stage) - transcription done
            logger.info(f"🔄 Step 6: Updating video status to 'summarizing'...")
            videos_repo = GenericRepository(Videos, self.db_session)
            video = videos_repo.find_one({"id": video_id})
            if video:
                videos_repo.update(
                    {"id": video_id},
                    {"status": "summarizing"},  # Next stage handled by Python backend
                )
                # Log status change
                self.status_log_service.log_status_change(
                    video_id,
                    "summarizing",
                    "python-backend",
                    "Transcription completed, starting summarization",
                )
                logger.info(f"✅ Updated video {video_id} status to 'summarizing'")
            else:
                logger.warning(f"⚠️ Video {video_id} not found when updating status to 'summarizing'")

            logger.info(
                f"✅ Transcription completed: videoId={video_id}, transcriptId={transcript_record.id}"
            )

            return {
                "transcript_id": transcript_record.id,
                "transcript_file_key": transcript_file_key,
                "segment_count": segment_count,
            }

        except Exception as e:
            logger.error(
                f"❌ Transcription failed for video {video_id}: {str(e)}",
                exc_info=True,
            )
            logger.error(f"📊 Error type: {type(e).__name__}")

            # Update video status to FAILED
            try:
                # Videos is already imported at the top of the file
                videos_repo = GenericRepository(Videos, self.db_session)
                video = videos_repo.find_one({"id": video_id})
                if video:
                    logger.info(
                        f"🔄 Updating video {video_id} status to FAILED due to error"
                    )
                    videos_repo.update(
                        {"id": video_id},
                        {
                            "status": "failed",
                            "status_message": str(e),
                        },
                    )
                    # Log status change
                    self.status_log_service.log_status_change(
                        video_id,
                        "failed",
                        "python-backend",
                        f"Transcription failed: {str(e)}",
                    )
                    logger.info(f"✅ Updated video {video_id} status to FAILED")
                else:
                    logger.warning(f"⚠️ Video {video_id} not found, cannot update status")
            except Exception as status_error:
                logger.error(
                    f"❌ Failed to update video status: {str(status_error)}",
                    exc_info=True,
                )

            raise

        finally:
            # Cleanup temp files
            self._cleanup_temp_files(temp_video_path, temp_audio_path)

    def _download_video_from_s3(self, s3_key: str, video_id: int) -> str:
        """Download video from S3 to temporary file."""
        logger.info(f"📥 Downloading video from S3: bucket={self.bucket}, key={s3_key}")

        s3 = get_s3_client()
        temp_dir = tempfile.gettempdir()
        temp_file = os.path.join(temp_dir, f"video_{video_id}_transcribe.mp4")

        try:
            # Check if file exists first
            logger.debug(f"🔍 Checking if S3 object exists: {s3_key}")
            s3.head_object(Bucket=self.bucket, Key=s3_key)
            logger.debug(f"✅ S3 object exists, proceeding with download")

            s3.download_file(self.bucket, s3_key, temp_file)
            file_size = os.path.getsize(temp_file) if os.path.exists(temp_file) else 0
            logger.info(
                f"✅ Video downloaded to: {temp_file} (size: {file_size} bytes)"
            )
            return temp_file
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            logger.error(
                f"❌ Failed to download video from S3: {error_code} - {str(e)}"
            )
            logger.error(f"📋 S3 bucket: {self.bucket}, key: {s3_key}")
            raise

    def _extract_audio(self, video_path: str, video_id: int) -> str:
        """Extract audio from video file using ffmpeg."""
        import subprocess

        logger.info(f"🎵 Extracting audio from video: {video_path}")

        if not os.path.exists(video_path):
            error_msg = f"Video file not found: {video_path}"
            logger.error(f"❌ {error_msg}")
            raise FileNotFoundError(error_msg)

        temp_dir = tempfile.gettempdir()
        audio_path = os.path.join(temp_dir, f"audio_{video_id}_transcribe.wav")

        try:
            # Use ffmpeg to extract audio (mono, 16kHz - optimal for Whisper)
            logger.debug(
                f"🔧 Running ffmpeg command: ffmpeg -i {video_path} -ac 1 -ar 16000 -vn -f wav -y {audio_path}"
            )
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i", video_path,
                    "-ac", "1",  # Mono
                    "-ar", "16000",  # 16kHz sample rate
                    "-vn",  # No video
                    "-f", "wav",
                    "-y",  # Overwrite
                    audio_path,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            audio_size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 0
            logger.info(
                f"✅ Audio extracted to: {audio_path} (size: {audio_size} bytes)"
            )
            if result.stderr:
                logger.debug(f"FFmpeg stderr: {result.stderr}")
            return audio_path
        except subprocess.CalledProcessError as e:
            logger.error(
                f"❌ Failed to extract audio: {str(e)}, returncode={e.returncode}"
            )
            if e.stderr:
                logger.error(f"FFmpeg stderr: {e.stderr}")
            if e.stdout:
                logger.debug(f"FFmpeg stdout: {e.stdout}")
            raise
        except FileNotFoundError:
            logger.error("❌ ffmpeg not found. Please install ffmpeg.")
            raise

    def _upload_transcript_to_s3(
        self, video_id: int, transcript_text: str, segments: list
    ) -> str:
        """Upload transcript JSON to S3."""
        transcript_key = f"transcripts/{video_id}/transcript.json"

        transcript_data = {
            "video_id": video_id,
            "full_text": transcript_text,
            "segments": segments,
            "created_at": None,  # Will be set by timestamp
        }

        try:
            s3 = get_s3_client()
            s3.put_object(
                Bucket=self.bucket,
                Key=transcript_key,
                Body=json.dumps(transcript_data, indent=2),
                ContentType="application/json",
            )
            logger.info(f"✅ Transcript uploaded to S3: {transcript_key}")
            return transcript_key
        except ClientError as e:
            logger.error(f"Failed to upload transcript to S3: {str(e)}")
            raise

    def _save_transcript_with_outbox(
        self,
        video_id: int,
        transcript_text: str,
        transcript_file_key: str,
        segment_count: int,
        whisper_result: Dict,
    ):
        """Save transcript to database and add event to outbox in transaction."""
        import uuid
        from datetime import datetime

        try:
            # 1. Save/update transcript
            existing = self.transcript_repo.find_one({"video_id": video_id})
            if existing:
                transcript_record = self.transcript_repo.update(
                    {"video_id": video_id},
                    {
                        "transcript_text": transcript_text,
                        "transcript_path": transcript_file_key,
                        "status": "ready",
                        "duration_seconds": int(whisper_result.get("duration", 0)),
                        "model_info": {
                            "model": "whisper",
                            "model_name": self.model_name,
                            "language": whisper_result.get("language"),
                            "segment_count": segment_count,
                        },
                    },
                )
            else:
                transcript_record = self.transcript_repo.create(
                    {
                        "video_id": video_id,
                        "transcript_text": transcript_text,
                        "transcript_path": transcript_file_key,
                        "status": "ready",
                        "duration_seconds": int(whisper_result.get("duration", 0)),
                        "model_info": {
                            "model": "whisper",
                            "model_name": self.model_name,
                            "language": whisper_result.get("language"),
                            "segment_count": segment_count,
                        },
                    }
                )

            # 2. Add event to outbox (same pattern as video.summarized)
            event_payload = {
                "id": str(uuid.uuid4()),
                "videoId": video_id,
                "transcriptFileKey": transcript_file_key,
                "snippetCount": segment_count,
                "ts": datetime.utcnow().isoformat(),
            }

            self.outbox_service.add_to_outbox(
                topic="video.transcribed",
                payload=event_payload,
                db_session=self.db_session,
                service="python-backend",
            )

            logger.info(
                f"📝 Saved transcript and outbox event: videoId={video_id}"
            )

            return transcript_record

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"❌ Failed to save transcript with outbox: {str(e)}")
            raise

    def _cleanup_temp_files(self, *file_paths):
        """Cleanup temporary files."""
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.debug(f"🗑️ Cleaned up temp file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {file_path}: {str(e)}")

