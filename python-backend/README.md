# YouTube AI Python Backend

FastAPI backend service for video summarization using Kafka, Celery, and OpenAI.

## Features

- **Kafka Integration**: Consumer for `video.transcribed` events, producer for `video.summarized` events
- **PostgreSQL**: Database models and repository pattern (similar to nest-be)
- **Celery**: Background task processing (similar to BullMQ in nest-be)
- **OpenAI**: LLM-based summarization with map-reduce pattern
- **S3 Integration**: Download transcripts and upload summaries

## Project Structure

```
python-backend/
├── config.py                  # Configuration management
├── main.py                    # FastAPI application entry point
├── celery_app.py              # Celery application
├── kafka_worker.py            # Kafka consumer worker
├── requirements.txt           # Python dependencies
├── .env.sample                # Environment variables template
├── database/
│   ├── base.py                # Database base and session
│   ├── models.py              # SQLAlchemy models
│   └── repository.py          # Generic CRUD repository
├── kafka/
│   ├── producer.py            # Kafka producer service
│   └── consumer.py            # Kafka consumer service
├── services/
│   └── video_summary_service.py  # Video summarization service
├── tasks/
│   └── video_summary.py       # Celery tasks
└── routers/
    └── health.py              # Health check endpoints
```

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.sample` to `.env` and update values:

```bash
cp .env.sample .env
```

Update the following:
- `HOST_IP`: Your actual host IP
- `OPENAI_API_KEY`: Your OpenAI API key
- Database credentials
- Kafka brokers

### 3. Create Kafka Topics

Create required Kafka topics (the consumer will auto-create if it doesn't exist, but it's good to create them upfront):

```bash
python scripts/create_kafka_topics.py
# Or using Makefile:
make create-topics
```

Required topics:
- `video.transcribed` - Input topic for Python backend
- `video.summarized` - Output topic from Python backend

### 4. Database Migration

The application will automatically create tables on startup. For production, use Alembic:

```bash
# Initialize Alembic (first time)
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### 5. Run Services

#### Option 1: Run All Services Together (Recommended for Development)

```bash
python run_all.py
# Or using Makefile:
make run-all
```

This will start all three services in one process:
- FastAPI application (http://localhost:8081)
- Celery worker
- Kafka consumer

Press `Ctrl+C` to stop all services.

#### Option 2: Run Services Separately

**FastAPI Application:**
```bash
python run.py
# Or: make run
```

**Celery Worker (in separate terminal):**
```bash
make worker
# Or: celery -A celery_app worker --loglevel=info --concurrency=2
```

**Kafka Consumer Worker (in separate terminal):**
```bash
make kafka-worker
# Or: python kafka_worker.py
```

## API Endpoints

- `GET /`: Root endpoint
- `GET /api/v1`: API info
- `GET /api/v1/health`: Health check
- `GET /api/v1/health/live`: Liveness probe
- `GET /api/v1/health/ready`: Readiness probe

## Event Flow

1. **Consume**: Kafka consumer receives `video.transcribed` event
2. **Queue**: Event is queued as Celery task
3. **Process**: Celery worker processes the task:
   - Downloads transcript from S3
   - Chunks transcript
   - Map: Summarizes each chunk with OpenAI
   - Reduce: Combines summaries into final summary
   - Uploads summary to S3
   - Saves to database
4. **Emit**: Publishes `video.summarized` event to Kafka

## Kafka Topics

- **Consumer**: `video.transcribed`
- **Producer**: `video.summarized`

## Database Tables

- `video_transcripts`: Video transcription records
- `video_summaries`: Video summary records (created by this service)

## Environment Variables

See `.env.sample` for all available environment variables. The format matches nest-be's `.env.sample`.

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black .
isort .
```

### Type Checking

```bash
mypy .
```

## Production Deployment

1. Use production-grade ASGI server (Gunicorn + Uvicorn workers)
2. Run Celery workers with proper process management (Supervisor/systemd)
3. Use Redis Sentinel for high availability
4. Configure proper logging and monitoring
5. Set up database connection pooling
6. Use environment-specific configuration

