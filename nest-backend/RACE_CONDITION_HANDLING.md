# Race Condition Handling Approach

This document outlines the strategies used to handle race conditions in the YouTube AI platform.

## Overview

Race conditions occur when multiple operations try to access and modify shared resources concurrently, leading to unpredictable or incorrect results. Our system implements multiple layers of protection to ensure data consistency and prevent race conditions.

## 1. Comment Like/Unlike Feature

### Problem
Multiple users (or rapid clicks from the same user) trying to like/unlike a comment simultaneously can cause:
- Incorrect `likes` count
- Duplicate `CommentLike` records
- Lost updates

### Solution

#### A. Database-Level Unique Constraint
- **Entity**: `CommentLike` has a `UNIQUE` constraint on `(user_id, comment_id)`
- **Benefit**: Database enforces one like per user per comment at the schema level
- **Race Condition Handling**: If two requests try to create the same like simultaneously, one succeeds, the other fails with a unique constraint violation (code `23505`), which we catch and handle gracefully

#### B. Database Transactions
- **Implementation**: `toggleLikeComment` uses `DataSource.transaction()` to ensure atomicity
- **Benefit**: All operations (check existing like, create/delete like, update count) happen atomically
- **Race Condition Handling**: Transaction isolation prevents concurrent modifications from interfering

#### C. Atomic Database Updates
- **Implementation**: Using raw SQL for counter updates: `UPDATE comments SET likes = likes + 1 WHERE id = :commentId`
- **Benefit**: Database handles the increment/decrement atomically at the SQL level
- **Race Condition Handling**: Even if multiple transactions run concurrently, the database ensures the counter is updated correctly

#### D. Error Handling
```typescript
catch (error: any) {
  if (error.code === '23505') {
    // PostgreSQL unique constraint violation - another request already liked
    // Return that user has liked it (idempotent response)
    hasLiked = true;
  }
}
```

## 2. Video Upload and Processing

### Problem
- Multiple services trying to process the same video
- Duplicate Kafka message processing
- Inconsistent state updates

### Solution

#### A. Idempotency with `processed_messages` Table
- **Implementation**: Track processed Kafka messages by `messageId`
- **Benefit**: Prevents duplicate processing even if Kafka delivers the same message multiple times
- **Race Condition Handling**: Database unique constraint on `messageId` ensures only one processing per message

#### B. BullMQ Job Queues
- **Implementation**: Video transcoding/transcription jobs go through BullMQ queues
- **Benefit**: Sequential processing with controlled concurrency
- **Race Condition Handling**: BullMQ ensures jobs are processed exactly once, even with multiple workers

#### C. Outbox Pattern
- **Implementation**: Events written to `outbox_events` table in same transaction as data updates
- **Benefit**: Ensures event publishing is transactional
- **Race Condition Handling**: Prevents events from being lost if Kafka is down, and prevents duplicate publishing

## 3. Database Operations

### Problem
- Concurrent updates to the same row
- Lost updates
- Inconsistent state

### Solution

#### A. TypeORM Transactions
- **Implementation**: Critical operations wrapped in `DataSource.transaction()`
- **Example**: `saveVideo` creates video and outbox event atomically
- **Race Condition Handling**: ACID properties ensure all-or-nothing execution

#### B. Optimistic Locking (Future Consideration)
- **Approach**: Add `version` column to entities that need concurrent edit protection
- **Benefit**: Updates only proceed if version matches
- **Use Case**: Video description edits, comment edits (if multiple users can edit)

## 4. Distributed Systems (Kafka, BullMQ)

### Problem
- Consumer rebalancing causing duplicate processing
- Network partitions causing message retries
- Multiple service instances processing the same job

### Solution

#### A. Idempotent Consumers
- **Implementation**: `processed_messages` table tracks processed events
- **Benefit**: Consumers can safely retry without duplicates
- **Race Condition Handling**: Database constraint prevents duplicate processing

#### B. Dead-Letter Queues (DLQ)
- **Implementation**: BullMQ jobs that fail N times go to DLQ
- **Benefit**: Prevents infinite retry loops
- **Race Condition Handling**: Failed jobs are isolated and don't interfere with new jobs

## 5. Summary of Strategies

| Feature | Strategy | Implementation |
|---------|----------|----------------|
| Comment Likes | Unique Constraint + Transaction + Atomic Updates | `CommentLike` entity, `toggleLikeComment` method |
| Kafka Messages | Idempotency Table | `processed_messages` table |
| Video Processing | BullMQ Queues | Job queues with concurrency limits |
| Event Publishing | Outbox Pattern | `outbox_events` table |
| Critical Updates | Database Transactions | TypeORM `DataSource.transaction()` |
| Counter Updates | Atomic SQL | Raw SQL `UPDATE SET count = count + 1` |

## Best Practices

1. **Always use transactions** for operations that modify multiple related entities
2. **Add unique constraints** where business logic requires uniqueness (e.g., one like per user)
3. **Use atomic database operations** for counters (increment/decrement)
4. **Implement idempotency** for distributed system operations (Kafka, queues)
5. **Handle constraint violations gracefully** - return idempotent responses
6. **Log race condition detections** for monitoring and debugging

## Monitoring

- Log unique constraint violations as warnings (they indicate race conditions were detected and handled)
- Monitor transaction rollback rates
- Track DLQ job counts
- Monitor `processed_messages` for duplicate message attempts

