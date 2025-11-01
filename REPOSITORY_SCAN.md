# Repository Scan Report

**Date:** 2025-11-01
**Repository:** youtube.ai
**Status:** ✅ Complete Scan

---

## 📋 Executive Summary

This repository contains a **dual-backend architecture** for a YouTube AI video processing platform:

- **NestJS Backend** (`nest-backend`): Primary API service handling uploads, transcoding, transcription, search, and user management
- **Python Backend** (`python-backend`): Specialized service for video summarization using OpenAI LLM

Both backends share:
- PostgreSQL database (with schema synchronization)
- Kafka event streaming (shared outbox pattern)
- Redis for caching/queuing
- AWS S3 for object storage

---

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend (Port 8080)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   REST API   │  │   Kafka      │  │   BullMQ Workers     │  │
│  │  Controllers │  │  Consumers   │  │   (Job Processors)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis    │ │    Kafka     │
└──────────────┘ └─────────────┘ └──────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Python Backend (Port 8081)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  FastAPI     │  │   Kafka      │  │   Celery Workers     │  │
│  │  Endpoints   │  │  Consumer    │  │   (Tasks)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   AWS S3     │  │   OpenAI     │  │   OpenSearch        │  │
│  │   (MinIO)    │  │   API        │  │   (Elasticsearch)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 NestJS Backend (`nest-backend`)

### Technology Stack

- **Framework:** NestJS 10.x (Node.js/TypeScript)
- **Database:** PostgreSQL with TypeORM
- **Cache/Queue:** Redis with BullMQ
- **Message Queue:** Kafka (Redpanda compatible)
- **Search:** OpenSearch (Elasticsearch compatible)
- **Object Storage:** AWS S3 (MinIO compatible)
- **Video Processing:** FFmpeg (via fluent-ffmpeg)
- **Authentication:** JWT with Passport

### Project Structure

```
nest-backend/
├── src/
│   ├── main.ts                          # Application entry point
│   ├── app.module.ts                     # Root module
│   ├── app.controller.ts                 # Root controller
│   ├── app.service.ts                    # Root service
│   │
│   ├── common/                           # Shared utilities
│   │   ├── decorators/                   # Custom decorators (Public, etc.)
│   │   ├── dtos/                         # Common DTOs (pagination, etc.)
│   │   ├── enums/                        # Enums (config, entities, status)
│   │   ├── filters/                      # Exception filters
│   │   ├── guards/                       # Auth guards (JWT)
│   │   ├── helpers/                      # Helper functions
│   │   ├── interceptors/                 # Response interceptors
│   │   └── interfaces/                   # Common interfaces
│   │
│   ├── configs/                          # Configuration modules
│   │   ├── auth.config.ts                # JWT configuration
│   │   ├── aws.config.ts                 # S3 configuration
│   │   ├── kafka.config.ts               # Kafka configuration
│   │   ├── opensearch.config.ts          # OpenSearch configuration
│   │   ├── postgres.config.ts            # PostgreSQL configuration
│   │   ├── redis.config.ts               # Redis configuration
│   │   ├── server.config.ts              # Server configuration
│   │   └── swagger.config.ts             # Swagger/OpenAPI configuration
│   │
│   ├── database/                         # Database modules
│   │   ├── opensearch/                   # OpenSearch integration
│   │   │   ├── opensearch.module.ts
│   │   │   ├── opensearch.service.ts
│   │   │   ├── builders/                 # Query builders
│   │   │   └── components/               # Query components
│   │   ├── postgres/                     # PostgreSQL integration
│   │   │   ├── postgres-database.module.ts
│   │   │   ├── abstract.entity.ts        # Base entity class
│   │   │   ├── entities/                 # TypeORM entities
│   │   │   │   ├── outbox-event.entity.ts
│   │   │   │   ├── processed-message.entity.ts
│   │   │   │   ├── video-summary.entity.ts
│   │   │   │   ├── video-transcript.entity.ts
│   │   │   │   └── video-variant.entity.ts
│   │   │   ├── interfaces/               # Base entity interfaces
│   │   │   └── repository/               # Generic CRUD repository
│   │   └── redis/                        # Redis integration
│   │       ├── redis-cache.module.ts
│   │       ├── redis.service.ts
│   │       └── redis.factory.ts
│   │
│   ├── modules/                          # Feature modules
│   │   ├── auth/                       # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts       # Signup, Login, Logout
│   │   │   ├── auth.service.ts          # Auth business logic
│   │   │   ├── strategy/                # Passport strategies
│   │   │   └── dtos/                    # Auth DTOs
│   │   │
│   │   ├── health/                      # Health check module
│   │   │   ├── health.module.ts
│   │   │   └── health.controller.ts     # Health endpoints
│   │   │
│   │   ├── user/                        # User management module
│   │   │   ├── user.module.ts
│   │   │   ├── controllers/
│   │   │   │   └── user.controller.ts   # User CRUD operations
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts       # User entity
│   │   │   ├── services/
│   │   │   │   └── user.service.ts      # User business logic
│   │   │   ├── processors/              # BullMQ processors
│   │   │   │   └── sync-user-emails.processor.ts
│   │   │   ├── schedulers/              # Cron schedulers
│   │   │   │   └── user-email-sync.scheduler.ts
│   │   │   ├── bloom-filter-state.service.ts
│   │   │   └── check-email.dto.ts
│   │   │
│   │   └── videos/                      # Videos module (consolidated)
│   │       ├── videos.module.ts
│   │       ├── controllers/
│   │       │   ├── upload.controller.ts      # Video upload endpoints
│   │       │   ├── videos.controller.ts     # Video listing/search
│   │       │   └── watch.controller.ts       # Video playback endpoints
│   │       ├── entities/
│   │       │   ├── video.entity.ts          # Video entity
│   │       │   └── upload-metadata.entity.ts
│   │       ├── dtos/
│   │       │   └── upload.dto.ts
│   │       ├── services/
│   │       │   ├── upload/                  # Upload services
│   │       │   │   ├── upload.service.ts
│   │       │   │   └── upload-kafka-producer.service.ts
│   │       │   ├── watch/                   # Watch services
│   │       │   │   └── watch.service.ts
│   │       │   ├── video-processor/         # Video processing services
│   │       │   │   ├── video-processor.service.ts
│   │       │   │   ├── video-processor-kafka-consumer.service.ts
│   │       │   │   └── video-transcription.service.ts
│   │       │   ├── search/                  # Search services
│   │       │   │   ├── video-search.service.ts
│   │       │   │   ├── video-search-index.service.ts
│   │       │   │   └── search-kafka-consumer.service.ts
│   │       │   ├── shared/                  # Shared services
│   │       │   │   └── outbox.service.ts
│   │       │   └── video-info.service.ts
│   │       ├── processors/                  # BullMQ job processors
│   │       │   ├── video-transcode.processor.ts
│   │       │   ├── video-transcribe.processor.ts
│   │       │   ├── video-index.processor.ts
│   │       │   └── outbox-publisher.processor.ts
│   │       ├── schedulers/                  # Cron schedulers
│   │       │   └── outbox-publisher.scheduler.ts
│   │       ├── constants/
│   │       │   ├── video-processor.constants.ts
│   │       │   └── search.constants.ts
│   │       ├── schemas/
│   │       │   └── video-search-schema.ts
│   │       └── interfaces/
│   │           └── video-search-document.interface.ts
│   │
│   └── providers/                         # Third-party providers
│       ├── bullmq/                        # BullMQ queue management
│       │   ├── bullmq.module.ts
│       │   ├── bullmq.service.ts
│       │   └── factory/
│       │       └── bullmq.factory.ts
│       ├── ffmpeg/                        # FFmpeg wrapper
│       │   ├── ffmpeg.module.ts
│       │   └── ffmpeg.service.ts
│       ├── kafka/                         # Kafka producer/consumer
│       │   └── kafka.module.ts
│       └── s3/                            # AWS S3 client
│           ├── s3.module.ts
│           └── s3.service.ts
│
└── package.json                           # Dependencies and scripts
```

### Key Features

#### 1. **Video Upload & Processing Pipeline**

Flow:
```
Upload → Transcode → Transcribe → (Kafka) → Summarize (Python) → Index → Ready
```

**Stages:**
1. **Upload** (`UploadController` → `UploadService`)
   - Receives video file via multipart upload
   - Generates presigned S3 URLs for upload
   - Creates video record with status `PENDING`
   - Publishes `video.uploaded` event to Kafka

2. **Transcoding** (`VideoProcessorService` → `VideoTranscodeProcessor`)
   - Consumes `video.uploaded` event
   - Downloads video from S3
   - Transcodes using FFmpeg to multiple variants (720p, 1080p)
   - Uploads variants to S3
   - Updates status to `TRANSCRIBING`
   - Publishes `video.transcoded` event

3. **Transcription** (`VideoTranscriptionService` → `VideoTranscribeProcessor`)
   - Consumes `video.transcoded` event
   - Downloads video from S3
   - Extracts audio and transcribes using FFmpeg/whisper
   - Saves transcript to `video_transcripts` table
   - Uploads transcript JSON to S3
   - Updates status to `SUMMARIZING`
   - Publishes `video.transcribed` event to Kafka (consumed by Python)

4. **Summarization** (Python Backend - see below)

5. **Indexing** (`VideoSearchIndexService` → `VideoIndexProcessor`)
   - Consumes `video.summarized` event from Kafka
   - Downloads summary and metadata
   - Indexes video in OpenSearch for search
   - Updates status to `READY`
   - Sets `processed_at` timestamp

#### 2. **Video Search**

- **OpenSearch Integration:** Full-text search across video titles, descriptions, transcripts, summaries
- **Query Builder:** Component-based query construction (match, multi-match, filters, range, geo)
- **Pagination:** Cursor-based pagination for large result sets
- **Endpoints:** `GET /api/v1/videos/search` with query parameters

#### 3. **Authentication & Authorization**

- **JWT-based authentication** with Passport.js
- **Endpoints:**
  - `POST /api/v1/auth/signup` - User registration
  - `POST /api/v1/auth/login` - User login
  - `POST /api/v1/auth/logout` - Token blacklisting
- **Token blacklisting:** Redis cache for revoked tokens
- **Guards:** `JwtAuthGuard` for protected routes
- **Public decorator:** `@Public()` for public endpoints

#### 4. **User Management**

- **CRUD operations** for user profiles
- **Email checking:** Bloom filter for fast email existence checks
- **Email synchronization:** Scheduled job to sync user emails to Bloom filter
- **Endpoints:**
  - `GET /api/v1/users/me` - Get current user
  - `POST /api/v1/users/check-email` - Check if email exists

#### 5. **Shared Outbox Pattern**

- **Reliable event publishing:** Both NestJS and Python write to `outbox_events` table
- **Centralized publishing:** NestJS scheduler publishes all events (from both services)
- **Benefits:**
  - Atomic transactions (database + outbox in same transaction)
  - Retry mechanism for failed publishes
  - Idempotency via event IDs

### Database Schema

**Tables:**
- `users` - User accounts
- `videos` - Video metadata and status
- `video_transcripts` - Transcription data
- `video_summaries` - AI-generated summaries
- `video_variants` - Multiple quality variants
- `outbox_events` - Event publishing queue
- `processed_messages` - Idempotency tracking
- `upload_metadata` - Upload tracking

**Video Status Enum:**
```typescript
enum VideoProcessingStatus {
  UPLOADING = 'uploading',
  PENDING = 'pending',
  TRANSCODING = 'transcoding',
  TRANSCRIBING = 'transcribing',
  SUMMARIZING = 'summarizing',
  INDEXING = 'indexing',
  READY = 'ready',
  FAILED = 'failed',
}
```

### Kafka Events

**Topics:**
1. `video.uploaded` - Published after video upload
2. `video.transcoded` - Published after video transcoding
3. `video.transcribed` - Published after transcription (consumed by Python)
4. `video.summarized` - Published after summarization (from Python)

### BullMQ Queues

1. **VIDEO_TRANSCODE_QUEUE** - Video transcoding jobs
2. **VIDEO_TRANSCRIBE_QUEUE** - Video transcription jobs
3. **VIDEO_SEARCH_INDEX_QUEUE** - Search indexing jobs
4. **OUTBOX_PUBLISHER_QUEUE** - Event publishing jobs
5. **SYNC_USER_EMAILS_QUEUE** - User email sync jobs

### API Endpoints

**Health:**
- `GET /api/v1/health` - Health check
- `GET /api/v1/health/live` - Liveness probe
- `GET /api/v1/health/ready` - Readiness probe

**Authentication:**
- `POST /api/v1/auth/signup` - Register user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user

**Users:**
- `GET /api/v1/users/me` - Get current user
- `POST /api/v1/users/check-email` - Check email existence

**Videos:**
- `POST /api/v1/videos/upload` - Upload video
- `GET /api/v1/videos/list` - List videos (paginated)
- `GET /api/v1/videos/search` - Search videos
- `GET /api/v1/videos/:id` - Get video details
- `GET /api/v1/videos/:id/watch` - Get video watch URL
- `GET /api/v1/videos/:id/transcript` - Get video transcript

---

## 🐍 Python Backend (`python-backend`)

### Technology Stack

- **Framework:** FastAPI 0.109.x
- **Database:** PostgreSQL with SQLAlchemy
- **Message Queue:** Kafka (kafka-python, confluent-kafka)
- **Task Queue:** Celery with Redis broker
- **AI/ML:** OpenAI API (GPT-3.5-turbo)
- **Object Storage:** AWS S3 (boto3)
- **Configuration:** Pydantic Settings

### Project Structure

```
python-backend/
├── main.py                      # FastAPI application entry point
├── config.py                    # Configuration (Pydantic Settings)
├── celery_app.py                # Celery application
├── kafka_worker.py              # Kafka consumer worker
├── run.py                       # FastAPI server runner
├── run_all.py                   # Run all services together
│
├── database/
│   ├── base.py                  # Database base and session factory
│   ├── models.py                # SQLAlchemy models
│   └── repository.py            # Generic CRUD repository
│
├── kafka_client/
│   ├── __init__.py
│   ├── consumer.py              # Kafka consumer service
│   ├── producer.py              # Kafka producer service (unused - uses outbox)
│   └── topic_manager.py        # Topic creation utilities
│
├── services/
│   ├── __init__.py
│   ├── video_summary_service.py # Video summarization logic
│   └── outbox_service.py        # Outbox event management
│
├── tasks/
│   ├── __init__.py
│   ├── video_summary.py         # Celery task for summarization
│   └── outbox_publisher.py      # Outbox publishing task (unused - NestJS handles)
│
├── routers/
│   ├── __init__.py
│   └── health.py                # Health check endpoints
│
├── schedulers/
│   ├── __init__.py
│   └── outbox_publisher.py      # Outbox scheduler (unused - NestJS handles)
│
├── scripts/
│   └── create_kafka_topics.py   # Kafka topic creation script
│
├── requirements.txt              # Python dependencies
├── Makefile                      # Development commands
├── README.md                     # Documentation
├── ARCHITECTURE.md               # Architecture documentation
├── FLOW_VERIFICATION.md         # Flow verification
└── REPOSITORY_SCAN.md            # Repository scan
```

### Key Features

#### 1. **Video Summarization Pipeline**

**Flow:**
```
Kafka Event (video.transcribed)
  → Celery Task Queue
  → Download Transcript from S3
  → Chunk Transcript
  → Map: Summarize Each Chunk (OpenAI)
  → Reduce: Combine Summaries
  → Upload Summary to S3
  → Save to Database
  → Write to Outbox
  → (NestJS publishes to Kafka)
```

**Process:**
1. **Consume Event:** Kafka consumer receives `video.transcribed` event
2. **Queue Task:** Celery task `summarize_video_task` queued
3. **Download Transcript:** Fetch transcript JSON from S3 using `transcriptFileKey`
4. **Chunk Transcript:** Split into 8000-token chunks (preserves metadata)
5. **Map Phase:** Call OpenAI API for each chunk in batches (5 chunks/batch)
   - Uses GPT-3.5-turbo
   - Custom prompts for chunk summarization
6. **Reduce Phase:** Recursively combine chunk summaries
   - If >10 chunks: reduce in batches of 5
   - Final reduction creates 4-6 sentence summary
7. **Upload Summary:** Upload both JSON and text versions to S3
8. **Save to Database:** Write to `video_summaries` table
9. **Update Video Status:** Update `videos.status` to `"indexing"`
10. **Write to Outbox:** Add `video.summarized` event to shared outbox table
    - Transaction ensures atomicity
    - Marked with `service="python-backend"`

#### 2. **Map-Reduce Implementation**

**Map Phase:**
- Chunks transcript by token count (~8000 tokens/chunk)
- Processes chunks in batches (5 at a time) to handle rate limits
- Each chunk gets summarized with OpenAI API
- Returns list of chunk summaries

**Reduce Phase:**
- Recursively combines summaries
- For large sets: reduces in batches of 5
- Final reduction uses specialized prompt for coherent 4-6 sentence summary
- Includes quality scoring

#### 3. **OpenAI Integration**

- **Model:** GPT-3.5-turbo
- **Rate Limiting:** Handled via batching
- **Error Handling:** Retries and error recovery
- **Token Management:** Chunking prevents token limits
- **Quality Scoring:** Calculates summary quality metrics

#### 4. **Outbox Pattern**

- **Shared Table:** Both services write to `outbox_events`
- **Python writes:** After summarization, writes event to outbox
- **NestJS publishes:** Scheduler picks up all events and publishes to Kafka
- **Service Tagging:** Events marked with `service="python-backend"`

### Database Models

**SQLAlchemy Models:**
- `Videos` - Video metadata (matches NestJS entity)
- `VideoTranscript` - Transcription data
- `VideoSummary` - AI-generated summaries
- `OutboxEvent` - Event publishing queue (UUID primary key)

**Video Status:** Uses string literals matching NestJS enum values:
- `"pending"`, `"uploading"`, `"transcoding"`, `"transcribing"`, `"summarizing"`, `"indexing"`, `"ready"`, `"failed"`

### Kafka Integration

**Consumer:**
- Topic: `video.transcribed`
- Handler: `handle_video_transcribed()`
- Queues: Celery task `summarize_video_task`

**Producer:**
- **Note:** Python does NOT publish directly to Kafka
- Uses shared outbox table (published by NestJS scheduler)

### Celery Tasks

1. **summarize_video_task** - Main summarization task
   - Processes video summary
   - Updates database
   - Writes to outbox

2. **publish_outbox_event_task** - Outbox publishing (unused, NestJS handles)

### API Endpoints

**Health:**
- `GET /` - Root endpoint
- `GET /api/v1` - API info
- `GET /api/v1/health` - Health check
- `GET /api/v1/health/live` - Liveness probe
- `GET /api/v1/health/ready` - Readiness probe

### Running Services

**Development:**
```bash
# Run all services together
python run_all.py

# Or separately:
python run.py              # FastAPI server
celery -A celery_app worker --loglevel=info  # Celery worker
python kafka_worker.py     # Kafka consumer
```

---

## 🔄 Event Flow Architecture

### Complete Video Processing Flow

```
1. Upload Video (NestJS)
   └─> POST /api/v1/videos/upload
       └─> UploadService
           └─> Create video record (status: PENDING)
           └─> Publish: video.uploaded (Kafka)

2. Transcode Video (NestJS)
   └─> Consume: video.uploaded
       └─> VideoProcessorService
           └─> Queue: VIDEO_TRANSCODE_QUEUE
               └─> VideoTranscodeProcessor
                   └─> Download video from S3
                   └─> Transcode with FFmpeg
                   └─> Upload variants to S3
                   └─> Update status: TRANSCODING → TRANSCRIBING
                   └─> Publish: video.transcoded (Kafka)

3. Transcribe Video (NestJS)
   └─> Consume: video.transcoded
       └─> VideoTranscriptionService
           └─> Queue: VIDEO_TRANSCRIBE_QUEUE
               └─> VideoTranscribeProcessor
                   └─> Download video from S3
                   └─> Extract audio and transcribe
                   └─> Save transcript to database
                   └─> Upload transcript JSON to S3
                   └─> Update status: TRANSCRIBING → SUMMARIZING
                   └─> Write to outbox: video.transcribed
                       └─> (Outbox publisher publishes to Kafka)

4. Summarize Video (Python)
   └─> Consume: video.transcribed (Kafka)
       └─> kafka_worker.py
           └─> Queue: Celery task summarize_video_task
               └─> VideoSummaryService
                   └─> Download transcript from S3
                   └─> Chunk transcript
                   └─> Map: Summarize chunks with OpenAI
                   └─> Reduce: Combine summaries
                   └─> Upload summary to S3
                   └─> Save to video_summaries table
                   └─> Update status: SUMMARIZING → INDEXING
                   └─> Write to outbox: video.summarized
                       └─> (NestJS outbox publisher publishes to Kafka)

5. Index Video (NestJS)
   └─> Consume: video.summarized (Kafka)
       └─> VideoSearchIndexService
           └─> Queue: VIDEO_SEARCH_INDEX_QUEUE
               └─> VideoIndexProcessor
                   └─> Download summary from S3
                   └─> Index in OpenSearch
                   └─> Update status: INDEXING → READY
                   └─> Set processed_at timestamp
```

### Outbox Pattern Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Service Writes Event to Outbox (Atomic Transaction)       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Save business data (e.g., video_summaries)      │   │
│  │  2. Insert into outbox_events                        │   │
│  │     - topic: "video.summarized"                      │   │
│  │     - payload: {...}                                  │   │
│  │     - service: "python-backend"                       │   │
│  │     - published: false                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  Both in same database transaction (atomic)                │
└──────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  NestJS Outbox Scheduler (runs every 5 seconds)            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Query outbox_events WHERE published = false     │   │
│  │  2. For each event:                                  │   │
│  │     - Queue: OUTBOX_PUBLISHER_QUEUE                  │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Outbox Publisher Processor (BullMQ)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  1. Publish to Kafka topic                           │   │
│  │  2. Mark as published: published = true             │   │
│  │  3. Set published_at timestamp                       │   │
│  │  4. Increment attempts on failure                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Shared Tables (Both Services)

#### `videos`
```sql
- id: INTEGER (PK, auto)
- title: TEXT
- description: TEXT
- user_id: INTEGER
- user_name: TEXT
- key: TEXT (S3 key)
- status: TEXT (enum values: pending, uploading, transcoding, transcribing, summarizing, indexing, ready, failed)
- status_message: TEXT (nullable)
- processed_at: TIMESTAMP (nullable)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `video_transcripts`
```sql
- id: INTEGER (PK, auto)
- video_id: INTEGER (UNIQUE)
- transcript_text: TEXT (nullable)
- transcript_path: TEXT (nullable, S3 key)
- status: TEXT
- duration_seconds: INTEGER (nullable)
- model_info: JSON (nullable)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `video_summaries`
```sql
- id: INTEGER (PK, auto)
- video_id: INTEGER (UNIQUE)
- summary_text: TEXT (nullable)
- summary_path: TEXT (nullable, S3 key)
- model_info: JSON (nullable)
- quality_score: FLOAT (nullable)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `outbox_events`
```sql
- id: UUID (PK)
- topic: TEXT
- payload: JSON
- published: BOOLEAN (default: false)
- attempts: INTEGER (default: 0)
- service: TEXT (nullable, e.g., "python-backend", "nest-be")
- created_at: TIMESTAMP
- published_at: TIMESTAMP (nullable)
```

#### `users`
```sql
- id: INTEGER (PK, auto)
- email: TEXT (UNIQUE)
- name: TEXT
- password_hash: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### `video_variants`
```sql
- id: INTEGER (PK, auto)
- video_id: INTEGER
- quality: TEXT (e.g., "720p", "1080p")
- key: TEXT (S3 key)
- created_at: TIMESTAMP
```

#### `processed_messages`
```sql
- id: INTEGER (PK, auto)
- message_id: TEXT (UNIQUE)
- processed_at: TIMESTAMP
```

---

## 🔐 Configuration

### Environment Variables

**Shared (both services):**
- `HOST_IP` - Common host IP for all services
- `DB_HOST`, `DB_PORT`, `PG_USER`, `PG_PASSWORD`, `DB_NAME`, `DB_SCHEMA` - PostgreSQL
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis
- `KAFKA_BROKERS` - Kafka broker addresses
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_YOUTUBE_BUCKET` - S3
- `USE_LOCALSTACK`, `AWS_S3_ENDPOINT` - MinIO/local S3

**NestJS-specific:**
- `PORT` - API server port (default: 8080)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET`, `JWT_EXPIRY` - JWT configuration
- `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` - OpenSearch
- `LOG_LEVEL` - Logging level

**Python-specific:**
- `PORT` - API server port (default: 8081)
- `OPENAI_API_KEY` - OpenAI API key
- `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` - Celery configuration
- `LOG_LEVEL` - Logging level

---

## 🚀 Deployment & Running

### NestJS Backend

```bash
# Install dependencies
cd nest-backend
npm install

# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Environment
cp env.sample .env
# Edit .env with your configuration
```

### Python Backend

```bash
# Install dependencies
cd python-backend
pip install -r requirements.txt

# Development (all services)
python run_all.py

# Production (separate processes)
python run.py              # FastAPI server
celery -A celery_app worker --loglevel=info  # Celery worker
python kafka_worker.py     # Kafka consumer

# Environment
cp env.sample .env
# Edit .env with your configuration
```

---

## 📊 Key Design Patterns

### 1. **Shared Outbox Pattern**
- **Purpose:** Reliable event publishing
- **Implementation:** Both services write to `outbox_events`, NestJS publishes all
- **Benefits:** Atomic transactions, retry mechanism, idempotency

### 2. **Repository Pattern**
- **NestJS:** Generic CRUD repository (`GenericCrudRepository`)
- **Python:** Generic repository (`GenericRepository`)
- **Benefits:** Consistent data access, testability

### 3. **Job Queue Pattern**
- **NestJS:** BullMQ for async job processing
- **Python:** Celery for async task processing
- **Benefits:** Scalability, retry logic, monitoring

### 4. **Service Layer Pattern**
- Both services use service classes for business logic
- Controllers/consumers call services
- Services orchestrate repository operations

### 5. **Event-Driven Architecture**
- Kafka for inter-service communication
- Decoupled services
- Scalable processing pipeline

---

## 🔍 Search & Indexing

### OpenSearch Integration

**Index:** `videos`
**Document Fields:**
- `id`, `title`, `description`
- `user_id`, `user_name`
- `transcript_text`, `summary_text`
- `status`, `created_at`
- Metadata fields

**Query Features:**
- Multi-match across title, description, transcript, summary
- Filtering by status, user, date range
- Pagination with cursor-based approach
- Sorting and relevance scoring

---

## ✅ Status Tracking

### Video Status Lifecycle

```
PENDING → UPLOADING → TRANSCODING → TRANSCRIBING → SUMMARIZING → INDEXING → READY
                                                                              ↓
                                                                           FAILED (on error)
```

**Status Updates:**
- `PENDING`: Initial video creation
- `UPLOADING`: File upload in progress
- `TRANSCODING`: Video transcoding
- `TRANSCRIBING`: Audio transcription
- `SUMMARIZING`: AI summarization (Python)
- `INDEXING`: Search index update
- `READY`: Processing complete
- `FAILED`: Error occurred (status_message contains details)

---

## 📝 Notes & Recommendations

### Current State
- ✅ Both backends synchronized
- ✅ Database schemas match
- ✅ Kafka event contracts align
- ✅ Status tracking consistent
- ✅ Outbox pattern working

### Recommendations
1. **Status Enum Consistency:** Consider Python enum class for type safety (optional)
2. **Monitoring:** Add monitoring/metrics (Prometheus, Grafana)
3. **Error Handling:** Enhance error recovery and dead letter queues
4. **Testing:** Add integration tests for event flow
5. **Documentation:** API documentation (Swagger) is available

---

## 📚 Documentation Files

- `SYNC_REPORT.md` - Synchronization verification report
- `python-backend/README.md` - Python backend documentation
- `python-backend/ARCHITECTURE.md` - Architecture details
- `python-backend/FLOW_VERIFICATION.md` - Flow verification
- `python-backend/REPOSITORY_SCAN.md` - Python backend scan

---

**End of Repository Scan Report**

