# Python Backend - Modular Structure

This document describes the modular, reusable code structure of the Python backend, mirroring the NestJS backend architecture.

## 📁 Directory Structure

```
python-backend/
├── common/                    # Shared utilities (like NestJS common/)
│   ├── constants/            # Shared constants
│   ├── exceptions/           # Custom exceptions
│   └── types/                # Type definitions
├── modules/                  # Feature modules (like NestJS modules/)
│   ├── videos/              # Video-related functionality
│   │   ├── services/        # Shared video services
│   │   ├── tasks/           # Video tasks
│   │   └── routers/         # Video routers (if needed)
│   ├── transcription/       # Transcription module
│   │   ├── services/        # Transcription services
│   │   ├── tasks/           # Transcription tasks
│   │   └── kafka_transcription_worker.py
│   ├── summary/             # Summary module
│   │   ├── services/        # Summary services
│   │   ├── tasks/           # Summary tasks
│   │   └── kafka_worker.py
│   └── health/              # Health module
│       ├── services/        # Health services (if needed)
│       └── routers/         # Health routers
├── providers/               # Infrastructure providers (like NestJS providers/)
│   └── kafka/               # Kafka provider
│       ├── consumer.py
│       ├── producer.py
│       └── topic_manager.py
├── database/                # Database layer
├── config.py                # Configuration
├── main.py                  # FastAPI application
├── celery_app.py            # Celery configuration
└── run_all.py               # Unified service runner
```

## 🎯 Module Organization

### Modules (Feature-based)

Each module contains:
- **services/**: Business logic services
- **tasks/**: Celery tasks (async workers)
- **routers/**: FastAPI routers (if needed)
- **constants.py**: Module-specific constants

#### Videos Module (`modules/videos/`)
- Shared services used by other modules:
  - `outbox_service.py` - Outbox pattern implementation
  - `processed_message_service.py` - Idempotency tracking
  - `video_status_log_service.py` - Video status logging

#### Transcription Module (`modules/transcription/`)
- `services/video_transcription_service.py` - Transcription logic
- `tasks/video_transcription.py` - Celery task
- `kafka_transcription_worker.py` - Kafka consumer worker

#### Summary Module (`modules/summary/`)
- `services/video_summary_service.py` - Summarization logic
- `tasks/video_summary.py` - Celery task
- `kafka_worker.py` - Kafka consumer worker

#### Health Module (`modules/health/`)
- `routers/health.py` - Health check endpoints

### Providers (Infrastructure)

Providers are reusable infrastructure components:

#### Kafka Provider (`providers/kafka/`)
- `consumer.py` - Kafka consumer service
- `producer.py` - Kafka producer service
- `topic_manager.py` - Topic management utilities

### Common (Shared Utilities)

- `constants/` - Shared constants (Kafka topics, etc.)
- `exceptions/` - Custom exception classes
- `types/` - Type definitions and TypedDict classes

## 🔄 Import Patterns

### Module Imports
```python
# Import from modules
from modules.videos.services.outbox_service import OutboxService
from modules.transcription.services.video_transcription_service import VideoTranscriptionService
from modules.summary.tasks.video_summary import summarize_video_task
```

### Provider Imports
```python
# Import from providers
from providers.kafka import create_consumer, get_kafka_producer
```

### Common Imports
```python
# Import from common
from common.constants.kafka import KAFKA_TOPIC_VIDEO_TRANSCRIBED
from common.exceptions.base import NotFoundException
from common.types.video import VideoTranscribedPayload
```

## 📝 Benefits

1. **Modularity**: Clear separation of concerns by feature
2. **Reusability**: Providers can be used across modules
3. **Maintainability**: Easy to locate and modify code
4. **Scalability**: Easy to add new modules or features
5. **Consistency**: Matches NestJS backend structure for familiarity

## 🔍 Migration Notes

- Old `kafka_client/` → `providers/kafka/`
- Old `services/` → `modules/{module}/services/`
- Old `tasks/` → `modules/{module}/tasks/`
- Old `routers/` → `modules/{module}/routers/`

