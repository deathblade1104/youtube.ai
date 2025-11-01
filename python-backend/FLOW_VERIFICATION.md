# Flow Verification: Video Summarization

## ✅ Complete Flow Verification

### 1. **Consume `video.transcribed` Event**
- ✅ Kafka consumer (`kafka_worker.py`) listens to `video.transcribed`
- ✅ Handler queues Celery task `summarize_video_task`
- ✅ Event payload contains: `videoId`, `transcriptFileKey` (S3 path)

### 2. **Download Transcript from S3**
- ✅ `VideoSummaryService._download_transcript()` uses S3 service
- ✅ Reads transcript JSON from S3 using `transcriptFileKey`
- ✅ Transcript format matches nest-be: `{segments: [...], full_text: "...", duration: ...}`

### 3. **Chunk Transcript**
- ✅ `_chunk_transcript()` splits transcript into manageable chunks
- ✅ Uses word count-based chunking (8000 tokens/chunk)
- ✅ Preserves segment metadata (start_time, end_time)

### 4. **Map Phase: Summarize Each Chunk**
- ✅ `_map_summarize_chunks()` processes chunks in batches
- ✅ Calls OpenAI API for each chunk via `_summarize_chunk()`
- ✅ Uses GPT-3.5-turbo with proper prompts
- ✅ Handles rate limits by batching (5 chunks per batch)

### 5. **Reduce Phase: Combine Summaries**
- ✅ `_reduce_summaries()` recursively combines chunk summaries
- ✅ For large summaries, recursively reduces in batches
- ✅ Final reduction creates coherent summary (4-6 sentences)

### 6. **Save Summary to Database**
- ✅ Saves to `video_summaries` table
- ✅ Stores: `summary_text`, `summary_path` (S3 key), `quality_score`, `model_info`
- ✅ Uses `video_summaries` table (NOT `video_transcripts`)

### 7. **Upload Summary to S3**
- ✅ `_upload_summary_to_s3()` uploads summary
- ✅ Uploads both JSON and text formats
- ✅ Returns S3 key for reference

### 8. **Add to Outbox (Reliable Publishing)**
- ✅ `_save_summary_with_outbox()` saves summary AND outbox event in transaction
- ✅ Event added to shared `outbox_events` table
- ✅ Marked with `service="python-backend"`
- ✅ nest-be scheduler will pick up and publish to Kafka

### 9. **Emit `video.summarized` Event**
- ✅ Event written to outbox with topic: `video.summarized`
- ✅ Payload includes: `videoId`, `summaryFileKey`, `qualityScore`
- ✅ Published by nest-be's outbox publisher scheduler

## ✅ S3 Integration Verification

### Reading from S3:
- ✅ `get_s3_client()` - Lazy initialization of S3 client
- ✅ `_download_transcript()` - Downloads transcript JSON from S3
- ✅ Uses `transcriptFileKey` from `video.transcribed` event

### Writing to S3:
- ✅ `_upload_summary_to_s3()` - Uploads summary to S3
- ✅ Stores at: `summaries/{video_id}/summary.json`
- ✅ Also uploads text version: `summaries/{video_id}/summary.txt`

## ✅ Map-Reduce Implementation Verification

### Map Phase:
1. ✅ Chunks transcript into segments (8000 tokens each)
2. ✅ Calls OpenAI API for each chunk
3. ✅ Returns list of chunk summaries

### Reduce Phase:
1. ✅ If >10 chunks, recursively reduces in batches of 5
2. ✅ Final reduction combines all summaries into coherent final summary
3. ✅ Uses specialized prompt for final summary (4-6 sentences, main themes)

## Summary

**Flow is correctly implemented:**
1. ✅ Consumes `video.transcribed`
2. ✅ Downloads transcript from S3 (reads `transcript_path` from event)
3. ✅ Chunks transcript properly
4. ✅ Map-reduces with OpenAI LLM calls
5. ✅ Saves to `video_summaries` table (NOT `video_transcripts`)
6. ✅ Uploads summary to S3
7. ✅ Adds to shared outbox table (published by nest-be)
8. ✅ Emits `video.summarized` via outbox pattern

**S3 Integration:**
- ✅ Properly reads transcripts from S3
- ✅ Properly writes summaries to S3
- ✅ Uses same bucket as nest-be

