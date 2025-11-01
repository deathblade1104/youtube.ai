# Repository Scan - YouTube AI Python Backend

## 📁 Project Structure

```
python-backend/
├── config.py                    # ✅ Pydantic settings (matches nest-be .env format)
├── main.py                      # ✅ FastAPI app with lifespan
├── celery_app.py                # ✅ Celery configuration
├── kafka_worker.py              # ✅ Kafka consumer worker entry point
├── run_all.py                   # ✅ Unified runner (FastAPI + Celery + Kafka)
├── run.py                       # ✅ FastAPI only runner
├── requirements.txt             # ✅ Python dependencies
├── env.sample                   # ✅ Environment template (matches nest-be)
├── Makefile                     # ✅ Helper commands
├── README.md                    # ✅ Documentation
├── ARCHITECTURE.md              # ✅ Architecture docs
├── FLOW_VERIFICATION.md         # ✅ Flow verification docs
│
├── database/
│   ├── base.py                  # ✅ SQLAlchemy base, session management
│   ├── models.py                # ✅ Models: VideoTranscript, VideoSummary, OutboxEvent
│   └── repository.py            # ✅ Generic CRUD repository (nest-be pattern)
│
├── kafka_client/                # ✅ Kafka integration (renamed from 'kafka' to avoid conflict)
│   ├── __init__.py
│   ├── producer.py              # ✅ Kafka producer (not used directly, via outbox)
│   ├── consumer.py              # ✅ Kafka consumer with auto-topic creation
│   └── topic_manager.py         # ✅ Topic creation utilities
│
├── services/
│   ├── __init__.py
│   ├── outbox_service.py        # ✅ Outbox service (shared table with nest-be)
│   └── video_summary_service.py # ✅ Map-reduce summarization with OpenAI
│
├── tasks/
│   ├── __init__.py
│   ├── video_summary.py         # ✅ Celery task for summarization
│   └── outbox_publisher.py      # ⚠️ Unused (removed - using nest-be scheduler)
│
├── schedulers/
│   ├── __init__.py
│   └── outbox_publisher.py      # ⚠️ Unused (removed - using nest-be scheduler)
│
├── routers/
│   ├── __init__.py
│   └── health.py                # ✅ Health check endpoints
│
└── scripts/
    └── create_kafka_topics.py   # ✅ Topic creation script
```

## 🔄 Event Flow

### Input: `video.transcribed`
**Source**: nest-be publishes after transcription completes

**Payload Structure**:
```json
{
  "id": "uuid",
  "videoId": 123,
  "transcriptFileKey": "transcripts/123/transcript.json",
  "snippetCount": 50,
  "ts": "2024-01-01T00:00:00Z"
}
```

**Handler**: `kafka_worker.py` → `handle_video_transcribed()`
- Queues Celery task: `summarize_video_task`

### Processing: Celery Task
**Task**: `tasks.video_summary.summarize_video_task()`

**Steps**:
1. ✅ Downloads transcript from S3 using `transcriptFileKey`
2. ✅ Chunks transcript (8000 tokens/chunk)
3. ✅ Map: Summarizes each chunk with OpenAI GPT-3.5-turbo
4. ✅ Reduce: Recursively combines summaries
5. ✅ Calculates quality score
6. ✅ Uploads summary to S3 (`summaries/{video_id}/summary.json`)
7. ✅ Saves to `video_summaries` table
8. ✅ Adds to shared `outbox_events` table (transaction)

### Output: `video.summarized`
**Published By**: nest-be outbox scheduler (shared table)

**Payload Structure**:
```json
{
  "id": "uuid",
  "videoId": 123,
  "summaryFileKey": "summaries/123/summary.json",
  "summaryText": "Full summary text...",
  "ts": "2024-01-01T00:00:00Z"
}
```

## 📊 Database Models

### `video_transcripts` (Read-only for python-backend)
- `video_id` (PK)
- `transcript_text`
- `transcript_path` (S3 key)
- `status`
- `duration_seconds`
- `model_info`

### `video_summaries` (Created/Updated by python-backend)
- `video_id` (PK)
- `summary_text`
- `summary_path` (S3 key)
- `model_info` (GPT-3.5-turbo, map-reduce method)
- `quality_score`

### `outbox_events` (Shared with nest-be)
- `id` (UUID, PK)
- `topic` (e.g., "video.summarized")
- `payload` (JSON)
- `published` (boolean)
- `attempts` (integer)
- `service` ("python-backend" or "nest-be")
- `created_at`
- `published_at`

## 🔌 Integrations

### S3
- ✅ **Read**: Downloads transcript JSON from S3
- ✅ **Write**: Uploads summary JSON and text to S3
- ✅ Uses same bucket as nest-be: `AWS_YOUTUBE_BUCKET`
- ✅ Supports LocalStack for local development

### Kafka
- ✅ **Consumer**: Listens to `video.transcribed`
- ✅ **Producer**: Not used directly (via outbox pattern)
- ✅ Auto-creates topics if missing
- ✅ Uses confluent-kafka library

### Celery
- ✅ **Broker**: Redis
- ✅ **Tasks**: `summarize_video_task`
- ✅ **Concurrency**: 2 workers (configurable)
- ✅ **Retries**: 3 attempts with 60s delay

### OpenAI
- ✅ **Model**: GPT-3.5-turbo
- ✅ **Map Phase**: Summarizes chunks (200 tokens, temperature=0.3)
- ✅ **Reduce Phase**: Final summary (500 tokens, temperature=0.3)
- ✅ **Batching**: 5 chunks per batch to avoid rate limits

## 🏗️ Architecture Patterns

### Repository Pattern
- ✅ Generic CRUD repository (matches nest-be)
- ✅ Type-safe with generics
- ✅ Error handling

### Outbox Pattern (Shared)
- ✅ Write to shared `outbox_events` table
- ✅ Mark with `service="python-backend"`
- ✅ nest-be scheduler publishes all events
- ✅ Transactional: Summary + Outbox in same transaction

### Database Connection
- ✅ SQLAlchemy with connection pooling
- ✅ Session management
- ✅ Automatic table creation on startup

## ⚙️ Configuration

### Environment Variables (from nest-be .env)
- ✅ PostgreSQL connection
- ✅ Redis connection
- ✅ Kafka brokers
- ✅ AWS S3 (with LocalStack support)
- ✅ OpenAI API key
- ✅ Celery broker/backend URLs (auto-constructed from Redis)

### Settings Management
- ✅ Pydantic Settings with validation
- ✅ Ignores extra fields from nest-be .env
- ✅ Auto-constructs Celery URLs from Redis settings

## 🚀 Services

### FastAPI Application
- ✅ Root endpoints (`/`, `/api/v1`)
- ✅ Health check (`/api/v1/health`)
- ✅ Swagger docs (via FastAPI)
- ✅ CORS enabled
- ✅ Global exception handling

### Celery Worker
- ✅ Processes `summarize_video_task`
- ✅ Database session per task
- ✅ Retry logic with exponential backoff

### Kafka Consumer
- ✅ Consumes `video.transcribed`
- ✅ Auto-creates topics
- ✅ Error handling and logging

## ✅ Verification Checklist

- [x] Consumes `video.transcribed` correctly
- [x] Downloads transcript from S3
- [x] Chunks transcript properly
- [x] Map-reduce with OpenAI
- [x] Saves to `video_summaries` table
- [x] Uploads summary to S3
- [x] Writes to shared outbox table
- [x] Payload matches: `{ id, videoId, summaryFileKey?, summaryText?, ts }`
- [x] nest-be scheduler will publish `video.summarized`
- [x] Follows nest-be patterns and conventions
- [x] All services can run in one command (`run_all.py`)

## 📝 Notes

- **Outbox Publishing**: Handled by nest-be scheduler (shared table approach)
- **S3 Integration**: Full read/write support with LocalStack
- **Transaction Safety**: Summary and outbox event saved atomically
- **Idempotency**: Checks for existing summaries before processing
- **Error Handling**: Comprehensive logging and retry mechanisms

