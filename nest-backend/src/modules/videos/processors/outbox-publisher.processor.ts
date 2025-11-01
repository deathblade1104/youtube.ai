import { Processor } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../../../database/postgres/entities/outbox-event.entity';
import { GenericWorkerHost } from '../../../providers/bullmq/generic/genericWorkerHost';
import { OutboxService } from '../services/shared/outbox.service';
import {
  OUTBOX_PUBLISHER_CONCURRENCY,
  OUTBOX_PUBLISHER_QUEUE,
} from '../constants/video-processor.constants';

export interface IOutboxPublisherData {
  outboxEventId: string;
  topic: string;
  payload: Record<string, any>;
}

@Processor(OUTBOX_PUBLISHER_QUEUE, {
  concurrency: OUTBOX_PUBLISHER_CONCURRENCY,
})
@Injectable()
export class OutboxPublisherProcessor
  extends GenericWorkerHost<IOutboxPublisherData, void>
  implements OnModuleInit
{
  constructor(
    @Inject('KAFKA_PRODUCER') private readonly kafka: ClientKafka,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly outboxService: OutboxService,
  ) {
    super(OUTBOX_PUBLISHER_QUEUE, OutboxPublisherProcessor.name);
  }

  async onModuleInit() {
    await this.kafka.connect();
  }

  protected getJobContext(job: Job<IOutboxPublisherData>): string {
    return `, topic=${job.data.topic}, eventId=${job.data.outboxEventId}`;
  }

  protected async processJob(job: Job<IOutboxPublisherData>): Promise<void> {
    const { outboxEventId, topic, payload } = job.data;

    try {
      // Publish to Kafka with event ID for idempotency
      await this.kafka.emit(topic, {
        ...payload,
        eventId: outboxEventId, // Include event ID for idempotency
      });

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

