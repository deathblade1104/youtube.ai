import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export abstract class GenericWorkerHost<
  TData = any,
  TResult = any,
> extends WorkerHost {
  protected readonly logger: Logger;
  protected readonly queueName: string;

  constructor(queueName: string, loggerName?: string) {
    super();
    this.queueName = queueName;
    this.logger = new Logger(loggerName || this.constructor.name);

    // ✅ Worker initialization log
    this.logger.log(`🚀 Worker initialized for queue: ${this.queueName}`);
  }

  // ✅ Worker ready event
  onWorkerReady() {
    this.logger.log(
      `✅ Worker ready and listening for jobs on queue: ${this.queueName}`,
    );
  }

  // ✅ Job started event
  onJobStarted(job: Job<TData>) {
    this.logger.log(
      `📥 Job started: ${job.id}${this.getJobContext(job)}, attempts : ${job.attemptsMade}`,
    );
  }

  // ✅ Job completed event
  onJobCompleted(job: Job<TData>, result: TResult) {
    this.logger.log(
      `✅ Job completed: ${job.id}${this.getJobContext(job)}, attempts : ${job.attemptsMade}`,
    );
  }

  // ✅ Job failed event
  onJobFailed(job: Job<TData>, err: Error) {
    this.logger.error(
      `❌ Job failed: ${job.id} : ${this.getJobContext(job)}, attempts : ${job.attemptsMade}`,
      err.stack,
    );
  }

  // Abstract method that child classes must implement
  protected abstract processJob(job: Job<TData>): Promise<TResult>;

  // Optional method to provide additional context for logging
  protected getJobContext(job: Job<TData>): string {
    return '';
  }

  // Main process method that handles the job
  async process(job: Job<TData>): Promise<TResult> {
    // Manually trigger job started event
    this.onJobStarted(job);

    this.logger.log(`🔄 Processing job ${job.id}${this.getJobContext(job)}`);

    try {
      const result = await this.processJob(job);

      // Manually trigger job completed event
      this.onJobCompleted(job, result);
      return result;
    } catch (error) {
      // Manually trigger job failed event
      this.onJobFailed(job, error);
      this.logger.error(`❌ Error processing job ${job.id}:`, error.stack);
      throw error;
    }
  }
}
