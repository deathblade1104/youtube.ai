"""Video summary service with OpenAI integration."""
import json
import logging
import os
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError
from openai import OpenAI

from config import get_settings
from database.models import VideoSummary, VideoStatusLog
from database.repository import GenericRepository
from modules.videos.services.outbox_service import OutboxService
from modules.videos.services.video_status_log_service import VideoStatusLogService

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize OpenAI client (lazy initialization to avoid import errors)
_openai_client = None


def get_openai_client():
    """Get or create OpenAI client singleton."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client

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


class VideoSummaryService:
    """Service for generating video summaries using OpenAI."""

    def __init__(
        self,
        db_session,
        summary_repo: GenericRepository[VideoSummary],
        outbox_service: Optional[OutboxService] = None,
    ):
        """Initialize video summary service."""
        self.db_session = db_session
        self.summary_repo = summary_repo
        self.outbox_service = outbox_service or OutboxService(db_session)
        self.bucket = settings.aws_youtube_bucket
        self.chunk_size = 8000  # Tokens per chunk
        self.max_chunks_per_batch = 5  # Process 5 chunks at a time
        # Initialize status log service
        status_log_repo = GenericRepository(VideoStatusLog, db_session)
        self.status_log_service = VideoStatusLogService(db_session, status_log_repo)

    def process_summary(
        self, video_id: int, transcript_file_key: str
    ) -> Dict[str, Any]:
        """
        Process video summary: download transcript, chunk, map-reduce with LLM.

        Args:
            video_id: Video ID
            transcript_file_key: S3 key to transcript JSON file

        Returns:
            Dict with summary_id, summary_file_key, quality_score
        """
        logger.info(
            f"🎬 Starting summary processing for video {video_id}: {transcript_file_key}"
        )

        # 1. Download transcript from S3
        transcript_data = self._download_transcript(transcript_file_key)
        logger.info(f"📥 Downloaded transcript: {len(transcript_data.get('segments', []))} segments")

        # 2. Chunk transcript into manageable pieces
        chunks = self._chunk_transcript(transcript_data)
        logger.info(f"📝 Chunked transcript into {len(chunks)} chunks")

        # 3. Map: Generate summaries for each chunk
        chunk_summaries = self._map_summarize_chunks(chunks)
        logger.info(f"🗺️ Generated {len(chunk_summaries)} chunk summaries")

        # 4. Reduce: Combine chunk summaries into final summary
        final_summary = self._reduce_summaries(chunk_summaries)
        logger.info(f"🔗 Reduced to final summary ({len(final_summary)} chars)")

        # 5. Calculate quality score
        quality_score = self._calculate_quality_score(
            transcript_data, final_summary, chunk_summaries
        )

        # 6. Upload summary to S3
        summary_file_key = self._upload_summary_to_s3(video_id, final_summary)

        # 7. Save to database and add to outbox in transaction
        summary_record = self._save_summary_with_outbox(
            video_id, final_summary, summary_file_key, quality_score
        )

        logger.info(
            f"✅ Summary processing completed: videoId={video_id}, summaryId={summary_record.id}"
        )

        return {
            "summary_id": summary_record.id,
            "summary_file_key": summary_file_key,
            "quality_score": quality_score,
        }

    def _download_transcript(self, file_key: str) -> Dict[str, Any]:
        """Download transcript JSON from S3."""
        try:
            s3 = get_s3_client()
            response = s3.get_object(Bucket=self.bucket, Key=file_key)
            content = response["Body"].read().decode("utf-8")
            return json.loads(content)
        except ClientError as e:
            logger.error(f"Failed to download transcript from S3: {str(e)}")
            raise

    def _chunk_transcript(self, transcript_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Chunk transcript into manageable pieces for LLM processing.

        Args:
            transcript_data: Full transcript with segments

        Returns:
            List of chunk dictionaries
        """
        segments = transcript_data.get("segments", [])
        if not segments:
            # Fallback: use full_text if segments not available
            full_text = transcript_data.get("full_text", "")
            if full_text:
                return self._chunk_text(full_text)

        chunks = []
        current_chunk = {"text": "", "segments": [], "start_time": None, "end_time": None}
        current_length = 0

        for segment in segments:
            segment_text = segment.get("text", "").strip()
            if not segment_text:
                continue

            segment_length = len(segment_text.split())

            # If adding this segment would exceed chunk size, save current chunk
            if (
                current_length + segment_length > self.chunk_size
                and current_chunk["text"]
            ):
                chunks.append(current_chunk)
                current_chunk = {
                    "text": "",
                    "segments": [],
                    "start_time": segment.get("start"),
                    "end_time": None,
                }
                current_length = 0

            # Add segment to current chunk
            if not current_chunk["start_time"]:
                current_chunk["start_time"] = segment.get("start")

            current_chunk["text"] += " " + segment_text
            current_chunk["segments"].append(segment)
            current_chunk["end_time"] = segment.get("end")
            current_length += segment_length

        # Add final chunk
        if current_chunk["text"]:
            chunks.append(current_chunk)

        return chunks

    def _chunk_text(self, text: str) -> List[Dict[str, Any]]:
        """Fallback: chunk plain text into word-based chunks."""
        words = text.split()
        chunks = []
        for i in range(0, len(words), self.chunk_size):
            chunk_text = " ".join(words[i : i + self.chunk_size])
            chunks.append(
                {
                    "text": chunk_text,
                    "segments": [],
                    "start_time": None,
                    "end_time": None,
                }
            )
        return chunks

    def _map_summarize_chunks(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """
        Map phase: Generate summaries for each chunk using OpenAI.

        Args:
            chunks: List of transcript chunks

        Returns:
            List of chunk summaries
        """
        logger.info(f"🗺️ Starting map phase: Processing {len(chunks)} chunks in batches of {self.max_chunks_per_batch}")
        summaries = []

        # Process chunks in batches to avoid rate limits
        for i in range(0, len(chunks), self.max_chunks_per_batch):
            batch = chunks[i : i + self.max_chunks_per_batch]
            batch_num = (i // self.max_chunks_per_batch) + 1
            total_batches = (len(chunks) + self.max_chunks_per_batch - 1) // self.max_chunks_per_batch
            logger.info(f"📦 Processing batch {batch_num}/{total_batches} ({len(batch)} chunks)")
            batch_summaries = []

            for idx, chunk in enumerate(batch):
                chunk_num = i + idx + 1
                try:
                    logger.info(f"🔄 Processing chunk {chunk_num}/{len(chunks)}...")
                    summary = self._summarize_chunk(chunk["text"])
                    batch_summaries.append(summary)
                    logger.info(f"✅ Completed chunk {chunk_num}/{len(chunks)}")
                except Exception as e:
                    logger.error(f"❌ Failed to summarize chunk {chunk_num}: {str(e)}", exc_info=True)
                    # Fallback: use first 200 chars of chunk
                    batch_summaries.append(chunk["text"][:200] + "...")
                    logger.warning(f"⚠️ Using fallback summary for chunk {chunk_num}")

            summaries.extend(batch_summaries)
            logger.info(f"✅ Batch {batch_num}/{total_batches} completed")

        logger.info(f"✅ Map phase completed: {len(summaries)} summaries generated")
        return summaries

    def _summarize_chunk(self, chunk_text: str) -> str:
        """Summarize a single chunk using OpenAI."""
        try:
            client = get_openai_client()
            chunk_length = len(chunk_text)
            logger.info(f"🤖 Calling OpenAI API for chunk summarization (chunk length: {chunk_length} chars)")
            logger.debug(f"📝 Chunk preview: {chunk_text[:200]}...")

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that summarizes video transcripts. "
                        "Provide a concise summary of the key points in 2-3 sentences.",
                    },
                    {
                        "role": "user",
                        "content": f"Summarize this video transcript segment:\n\n{chunk_text}",
                    },
                ],
                max_tokens=200,
                temperature=0.3,
            )

            summary_text = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else None
            logger.info(f"✅ OpenAI API call successful - Summary length: {len(summary_text)} chars" +
                       (f", Tokens used: {tokens_used}" if tokens_used else ""))
            return summary_text
        except Exception as e:
            logger.error(f"❌ OpenAI API error during chunk summarization: {str(e)}", exc_info=True)
            raise

    def _reduce_summaries(self, chunk_summaries: List[str]) -> str:
        """
        Reduce phase: Combine chunk summaries into final summary.

        Args:
            chunk_summaries: List of chunk summaries

        Returns:
            Final combined summary
        """
        if not chunk_summaries:
            return "No summary available."

        # If we have many chunks, combine in batches
        if len(chunk_summaries) > 10:
            # Recursively reduce
            batch_size = 5
            reduced = []
            for i in range(0, len(chunk_summaries), batch_size):
                batch = chunk_summaries[i : i + batch_size]
                combined = "\n\n".join(batch)
                reduced_summary = self._summarize_chunk(combined)
                reduced.append(reduced_summary)
            return self._reduce_summaries(reduced)

        # Final reduction
        combined_summaries = "\n\n".join(chunk_summaries)
        logger.info(f"🔗 Calling OpenAI API for final summary reduction ({len(chunk_summaries)} chunks, {len(combined_summaries)} chars)")
        try:
            client = get_openai_client()
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that creates final video summaries. "
                        "Combine the provided chunk summaries into a coherent, comprehensive summary "
                        "of the entire video in 4-6 sentences. Focus on main themes and key insights.",
                    },
                    {
                        "role": "user",
                        "content": f"Combine these summaries into a final video summary:\n\n{combined_summaries}",
                    },
                ],
                max_tokens=500,
                temperature=0.3,
            )

            final_summary = response.choices[0].message.content.strip()
            tokens_used = response.usage.total_tokens if hasattr(response, 'usage') and response.usage else None
            logger.info(f"✅ OpenAI API reduction call successful - Final summary length: {len(final_summary)} chars" +
                       (f", Tokens used: {tokens_used}" if tokens_used else ""))
            return final_summary
        except Exception as e:
            logger.error(f"❌ OpenAI API error during reduction: {str(e)}", exc_info=True)
            # Fallback: return first summary
            logger.warning(f"⚠️ Using fallback summary (first 1000 chars)")
            return combined_summaries[:1000]

    def _calculate_quality_score(
        self,
        transcript_data: Dict[str, Any],
        final_summary: str,
        chunk_summaries: List[str],
    ) -> float:
        """
        Calculate quality score for the summary (0.0 to 1.0).

        Args:
            transcript_data: Original transcript data
            final_summary: Final summary text
            chunk_summaries: List of chunk summaries

        Returns:
            Quality score between 0.0 and 1.0
        """
        # Simple heuristic: based on summary length and chunk count
        transcript_length = len(transcript_data.get("full_text", ""))
        summary_length = len(final_summary)

        if transcript_length == 0:
            return 0.0

        # Score based on compression ratio (ideal: 10-20% of original)
        compression_ratio = summary_length / transcript_length
        if 0.1 <= compression_ratio <= 0.2:
            compression_score = 1.0
        elif compression_ratio < 0.1:
            compression_score = compression_ratio / 0.1
        else:
            compression_score = max(0.0, 1.0 - (compression_ratio - 0.2) / 0.3)

        # Score based on number of chunks processed
        chunk_score = min(1.0, len(chunk_summaries) / 10.0)

        # Final score: weighted average
        quality_score = (compression_score * 0.7) + (chunk_score * 0.3)
        return round(quality_score, 2)

    def _upload_summary_to_s3(self, video_id: int, summary_text: str) -> str:
        """Upload summary text to S3."""
        summary_key = f"summaries/{video_id}/summary.txt"
        summary_json = {
            "video_id": video_id,
            "summary": summary_text,
            "generated_at": None,  # Will be set by timestamp
        }

        try:
            s3 = get_s3_client()
            # Upload as JSON
            s3.put_object(
                Bucket=self.bucket,
                Key=summary_key.replace(".txt", ".json"),
                Body=json.dumps(summary_json, indent=2),
                ContentType="application/json",
            )

            # Also upload as text
            s3.put_object(
                Bucket=self.bucket,
                Key=summary_key,
                Body=summary_text,
                ContentType="text/plain",
            )

            logger.info(f"✅ Uploaded summary to S3: {summary_key}")
            return summary_key.replace(".txt", ".json")
        except ClientError as e:
            logger.error(f"Failed to upload summary to S3: {str(e)}")
            raise

    def _save_summary_with_outbox(
        self,
        video_id: int,
        summary_text: str,
        summary_file_key: str,
        quality_score: float,
    ) -> VideoSummary:
        """
        Save summary to database and add event to outbox in transaction.
        This ensures the event is persisted even if Kafka is down.
        """
        import uuid
        from datetime import datetime

        # Use transaction to ensure summary and outbox event are written atomically
        try:
            # 1. Save/update summary
            existing = self.summary_repo.find_one({"video_id": video_id})
            if existing:
                summary_record = self.summary_repo.update(
                    {"video_id": video_id},
                    {
                        "summary_text": summary_text,
                        "summary_path": summary_file_key,
                        "quality_score": quality_score,
                        "model_info": {
                            "model": "gpt-3.5-turbo",
                            "method": "map-reduce",
                            "chunk_size": self.chunk_size,
                        },
                    },
                )
            else:
                summary_record = self.summary_repo.create(
                    {
                        "video_id": video_id,
                        "summary_text": summary_text,
                        "summary_path": summary_file_key,
                        "quality_score": quality_score,
                        "model_info": {
                            "model": "gpt-3.5-turbo",
                            "method": "map-reduce",
                            "chunk_size": self.chunk_size,
                        },
                    }
                )

            # 2. Add event to outbox (in same transaction context)
            # Payload structure: { id, videoId, summaryFileKey?, summaryText?, ts }
            event_payload = {
                "id": str(uuid.uuid4()),
                "videoId": video_id,
                "summaryFileKey": summary_file_key,  # S3 key to summary JSON
                "summaryText": summary_text,  # Summary text (optional, but included for convenience)
                "ts": datetime.utcnow().isoformat(),
            }

            # 3. Update video status to INDEXING (next stage, nest-be will handle)
            # Note: Since nest-be consumes video.summarized and handles indexing,
            # we update status here to indicate summarization is complete
            # Optimize: Update directly without fetch if video exists (best-effort)
            from database.models import Videos
            videos_repo = GenericRepository(Videos, self.db_session)
            # Try to update directly - if video doesn't exist, update will return None
            updated_video = videos_repo.update(
                {"id": video_id},
                {"status": "indexing"},  # Next stage handled by nest-be
            )
            if updated_video:
                # Log status change
                self.status_log_service.log_status_change(
                    video_id,
                    "indexing",
                    "python-backend",
                    "Summarization completed, ready for indexing",
                )
                logger.info(f"📊 Updated video {video_id} status to indexing")

            # 4. Add event to outbox (in same transaction context)
            self.outbox_service.add_to_outbox(
                topic="video.summarized",
                payload=event_payload,
                db_session=self.db_session,
                service="python-backend",  # Mark service for nest-be scheduler
            )

            logger.info(
                f"📝 Saved summary and outbox event in transaction: videoId={video_id}"
            )

            return summary_record

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"❌ Failed to save summary with outbox: {str(e)}")
            raise

    def _save_summary(
        self,
        video_id: int,
        summary_text: str,
        summary_file_key: str,
        quality_score: float,
    ) -> VideoSummary:
        """Save summary to database (legacy method, use _save_summary_with_outbox)."""
        # Check if summary already exists
        existing = self.summary_repo.find_one({"video_id": video_id})
        if existing:
            # Update existing
            return self.summary_repo.update(
                {"video_id": video_id},
                {
                    "summary_text": summary_text,
                    "summary_path": summary_file_key,
                    "quality_score": quality_score,
                    "model_info": {
                        "model": "gpt-3.5-turbo",
                        "method": "map-reduce",
                        "chunk_size": self.chunk_size,
                    },
                },
            )

        # Create new
        return self.summary_repo.create(
            {
                "video_id": video_id,
                "summary_text": summary_text,
                "summary_path": summary_file_key,
                "quality_score": quality_score,
                "model_info": {
                    "model": "gpt-3.5-turbo",
                    "method": "map-reduce",
                    "chunk_size": self.chunk_size,
                },
            }
        )

