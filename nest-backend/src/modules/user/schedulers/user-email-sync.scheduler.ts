import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullQueueService } from '../../../providers/bullmq/bullmq.service';
import {
  SYNC_USER_EMAILS_DAILY_MIDNIGHT_JOB_NAME,
  SYNC_USER_EMAILS_IMMEDIATE_JOB_NAME,
  SYNC_USER_EMAILS_JOB_OPTIONS,
  SYNC_USER_EMAILS_JOB_QUEUE,
  SYNC_USER_EMAILS_REPEAT_OPTIONS,
} from '../user.constants';

@Injectable()
export class UserEmailSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(UserEmailSyncScheduler.name);

  constructor(private readonly bullQueueService: BullQueueService) {}

  async onModuleInit() {
    // Fire sync job immediately on server start
    await this.fireImmediateSync();

    // Schedule daily sync at midnight
    await this.scheduleDailySync();
  }

  /**
   * Fire the sync job immediately on server start (only if it doesn't exist)
   */
  private async fireImmediateSync() {
    try {
      const queue = await this.bullQueueService.getQueue(
        SYNC_USER_EMAILS_JOB_QUEUE,
      );
      const existingJobs = await queue.getJobs(['waiting', 'active'], 0, 10);

      // Check if the immediate sync job already exists
      const immediateJobExists = existingJobs.some(
        (job) => job.name === SYNC_USER_EMAILS_IMMEDIATE_JOB_NAME,
      );

      if (immediateJobExists) {
        this.logger.log(
          '⏭️  Immediate sync job already exists, skipping duplicate',
        );
        return;
      }

      await this.bullQueueService.addJob(
        SYNC_USER_EMAILS_JOB_QUEUE,
        SYNC_USER_EMAILS_IMMEDIATE_JOB_NAME,
        null,
        SYNC_USER_EMAILS_JOB_OPTIONS,
      );
      this.logger.log('✅ Triggered immediate user email sync job');
    } catch (error) {
      this.logger.error('Failed to trigger immediate sync job:', error);
    }
  }

  /**
   * Schedule the user email sync job to run daily at midnight (only if not exists)
   */
  private async scheduleDailySync() {
    try {
      const exists = await this.bullQueueService.hasRepeatableJob(
        SYNC_USER_EMAILS_JOB_QUEUE,
        SYNC_USER_EMAILS_DAILY_MIDNIGHT_JOB_NAME,
        SYNC_USER_EMAILS_REPEAT_OPTIONS.pattern,
      );

      if (exists) {
        this.logger.log(
          '⏭️  Daily midnight sync job already exists, skipping duplicate',
        );
        return;
      }

      await this.bullQueueService.addJob(
        SYNC_USER_EMAILS_JOB_QUEUE,
        SYNC_USER_EMAILS_DAILY_MIDNIGHT_JOB_NAME,
        null,
        {
          ...SYNC_USER_EMAILS_JOB_OPTIONS,
          repeat: SYNC_USER_EMAILS_REPEAT_OPTIONS,
        },
      );

      this.logger.log(
        '✅ Scheduled user email sync job to run daily at midnight (00:00 UTC)',
      );
    } catch (error) {
      this.logger.error('Failed to schedule user email sync job:', error);
    }
  }
}
