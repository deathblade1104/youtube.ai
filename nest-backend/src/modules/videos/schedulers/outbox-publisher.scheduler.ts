import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { BullQueueService } from '../../../providers/bullmq/bullmq.service';
import { OutboxService } from '../services/shared/outbox.service';
import {
  OUTBOX_PUBLISHER_QUEUE,
  PUBLISH_OUTBOX_JOB,
} from '../constants/video-processor.constants';

@Injectable()
export class OutboxPublisherScheduler implements OnModuleInit {
  private readonly logger = new Logger(OutboxPublisherScheduler.name);

  constructor(
    private readonly outboxService: OutboxService,
    private readonly bullQueueService: BullQueueService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    // Start polling immediately, then continue with cron
    await this.pollAndPublish();
  }

  /**
   * Poll outbox for unpublished events every 5 seconds
   */
  @Cron('*/5 * * * * *') // Every 5 seconds
  async pollAndPublish(): Promise<void> {
    try {
      const unpublishedEvents =
        await this.outboxService.getUnpublishedEvents(100);

      if (unpublishedEvents.length === 0) {
        return;
      }

      this.logger.debug(
        `📬 Found ${unpublishedEvents.length} unpublished outbox events`,
      );

      // Queue jobs for each unpublished event
      for (const event of unpublishedEvents) {
        await this.bullQueueService.addJob(
          OUTBOX_PUBLISHER_QUEUE,
          PUBLISH_OUTBOX_JOB,
          {
            outboxEventId: event.id,
            topic: event.topic,
            payload: event.payload,
          },
        );
      }

      this.logger.log(
        `✅ Queued ${unpublishedEvents.length} outbox events for publishing`,
      );
    } catch (error: any) {
      this.logger.error('❌ Error polling outbox events:', error.stack);
    }
  }
}

