# Architecture: Shared Outbox Pattern

## Shared Outbox Approach

We use a **shared `outbox_events` table** that both nest-be and python-backend write to. nest-be's scheduler publishes all events.

### Why This Approach?
- **Simplicity**: Single scheduler to maintain
- **Consistency**: All events go through same publishing pipeline
- **Reliability**: Centralized outbox management

### How It Works

1. **python-backend writes to outbox:**
   - Saves summary to `video_summaries` table
   - Adds event to `outbox_events` table with `service="python-backend"`
   - Both in same transaction (atomic)

2. **nest-be scheduler publishes:**
   - Polls `outbox_events` every 5 seconds
   - Finds all unpublished events (regardless of service)
   - Queues publishing tasks for each event
   - Publishes to Kafka and marks as published

### OutboxEvent Schema

```python
id: UUID (primary key)
topic: string (e.g., "video.summarized")
payload: JSON (event data)
published: boolean (false until published)
attempts: integer (retry counter)
service: string (nullable, e.g., "python-backend", "nest-be")
created_at: timestamp
published_at: timestamp (null until published)
```

## Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. video.transcribed (Kafka event from nest-be)            │
└──────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Kafka Consumer (python-backend)                         │
│    - Consumes video.transcribed                            │
│    - Queues Celery task                                    │
└──────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Celery Task: summarize_video_task                       │
│    - Downloads transcript from S3                          │
│    - Chunks transcript                                     │
│    - Map: Summarizes each chunk with OpenAI                │
│    - Reduce: Combines summaries                            │
│    - Saves to video_summaries table                        │
│    - Adds to outbox_events table (service="python-backend")│
└──────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. nest-be Outbox Scheduler (runs every 5s)                │
│    - Polls outbox_events for unpublished events           │
│    - Queues publishing tasks                               │
│    - Publishes to Kafka topic: video.summarized            │
│    - Marks event as published                              │
└─────────────────────────────────────────────────────────────┘
```

## Database Tables

- `video_summaries` - Stores video summaries (python-backend writes)
- `outbox_events` - Shared table for reliable event publishing (both services write, nest-be publishes)

## Notes

- python-backend **does NOT** publish directly to Kafka
- All publishing goes through shared outbox table
- nest-be scheduler handles all outbox events (from both services)
- `service` column helps identify which service created the event (for debugging)

