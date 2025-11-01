import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../../../database/postgres/entities/outbox-event.entity';
import { GenericWorkerHost } from '../../../providers/bullmq/generic/genericWorkerHost';
import { KafkaProducerService } from '../../../providers/kafka/kafka-producer.service';
import {
  OUTBOX_PUBLISHER_CONCURRENCY,
  OUTBOX_PUBLISHER_QUEUE,
} from '../constants/video-processor.constants';
import { OutboxService } from '../services/shared/outbox.service';

export interface IOutboxPublisherData {
  outboxEventId: string;
  topic: string;
  payload: Record<string, any>;
}

@Processor(OUTBOX_PUBLISHER_QUEUE, {
  concurrency: OUTBOX_PUBLISHER_CONCURRENCY,
})
@Injectable()
export class OutboxPublisherProcessor extends GenericWorkerHost<
  IOutboxPublisherData,
  void
> {
  constructor(
    private readonly kafkaProducerService: KafkaProducerService,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly outboxService: OutboxService,
  ) {
    super(OUTBOX_PUBLISHER_QUEUE, OutboxPublisherProcessor.name);
  }

  protected getJobContext(job: Job<IOutboxPublisherData>): string {
    return `, topic=${job.data.topic}, eventId=${job.data.outboxEventId}`;
  }

  protected async processJob(job: Job<IOutboxPublisherData>): Promise<void> {
    const { outboxEventId, topic, payload } = job.data;

    try {
      // Publish to Kafka with event ID for idempotency
      await this.kafkaProducerService.emit(topic, payload, outboxEventId);

      // Mark as published
      await this.outboxService.markAsPublished(outboxEventId);

      this.logger.log(
        `✅ Published outbox event to Kafka: topic=${topic}, eventId=${outboxEventId}`,
      );
    } catch (error: any) {
      // Increment attempts
      await this.outboxService.incrementAttempts(outboxEventId);

      this.logger.error(
        `❌ Failed to publish outbox event: topic=${topic}, eventId=${outboxEventId}, attempts=${job.attemptsMade + 1}`,
        error.stack,
      );

      throw error;
    }
  }
}
