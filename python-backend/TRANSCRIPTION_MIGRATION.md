# Video Transcription Migration to Python Backend

## Summary

Video transcription has been migrated from NestJS (using whisper.cpp) to Python backend (using OpenAI Whisper library). This provides:

- ✅ **Easier installation**: No need to build C++ binaries
- ✅ **Better maintainability**: Python library is well-maintained
- ✅ **Consistent environment**: Both summarization and transcription in Python
- ✅ **Simpler deployment**: pip install vs building from source

## Architecture Changes

### Before (NestJS)

```
NestJS Backend:
  video.transcoded event
    ↓
  Kafka Consumer (NestJS)
    ↓
  BullMQ Queue
    ↓
  Whisper.cpp (C++) → Transcription
    ↓
  video.transcribed event
```

### After (Python)

```
NestJS Backend:
  video.transcoded event
    ↓
Python Backend:
  Kafka Consumer (Python)
    ↓
  Celery Task
    ↓
  OpenAI Whisper (Python) → Transcription
    ↓
  video.transcribed event
```

## New Components

### 1. `services/video_transcription_service.py`

- Downloads video from S3
- Extracts audio using ffmpeg
- Transcribes using OpenAI Whisper
- Uploads transcript to S3
- Saves transcript to database
- Publishes `video.transcribed` event via outbox pattern
- Updates video status throughout the process

### 2. `tasks/video_transcription.py`

- Celery task for asynchronous transcription processing
- Handles retries and error recovery
- Updates video status on failure

### 3. `kafka_transcription_worker.py`

- Kafka consumer for `video.transcoded` events
- Queues Celery tasks for transcription

### 4. Updated `run_all.py`

- Now includes separate Kafka consumers for:
  - `video.transcoded` → Transcription
  - `video.transcribed` → Summarization

## Configuration

Add to `.env`:

```bash
# Whisper Model Configuration
# Options: tiny, base, small, medium, large
WHISPER_MODEL=base
```

## Dependencies

Added to `requirements.txt`:

```
openai-whisper>=20231117
```

**Note**: OpenAI Whisper requires `ffmpeg` to be installed on the system.

## Installation

1. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Install ffmpeg (if not already installed):**

   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt-get install ffmpeg
   ```

3. **Set environment variable (optional, defaults to 'base'):**

   ```bash
   export WHISPER_MODEL=base
   ```

## What Was Changed in NestJS

1. **`video-processor-kafka-consumer.service.ts`**
   - Removed transcription job queuing
   - Now only marks `video.transcoded` events as processed
   - Added comment noting Python backend handles transcription

2. **`video-processor.service.ts`**
   - Updated status message to indicate Python backend handles transcription

## Status Flow

1. NestJS sets status to `TRANSCRIBING` after transcoding
2. Python backend receives `video.transcoded` event
3. Python backend starts transcription → Status remains `TRANSCRIBING`
4. Transcription completes → Status changes to `SUMMARIZING`
5. Transcription failure → Status changes to `FAILED`

## Testing

1. Upload a video via NestJS backend
2. Wait for transcoding to complete
3. Check Python backend logs for:

   ```
   📥 Received video.transcoded event: eventId=..., videoId=...
   ✅ Queued transcription task: videoId=..., taskId=...
   🎤 Starting transcription for video ...
   🤖 Running Whisper transcription on ...
   ✅ Transcription completed: ...
   ```

## Benefits

- ✅ No more whisper.cpp build issues
- ✅ Consistent Python ecosystem
- ✅ Easier debugging and maintenance
- ✅ Better error handling with Celery retries
- ✅ Same outbox pattern for reliable event publishing
