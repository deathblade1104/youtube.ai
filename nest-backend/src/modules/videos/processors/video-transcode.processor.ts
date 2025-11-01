import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { BullQueueService } from '../../../providers/bullmq/bullmq.service';
import { GenericWorkerHost } from '../../../providers/bullmq/generic/genericWorkerHost';
import {
  TRANSCODE_WORKER_CONCURRENCY,
  VIDEO_TRANSCODE_DLQ,
  VIDEO_TRANSCODE_QUEUE,
} from '../constants/video-processor.constants';
import { Videos } from '../entities/video.entity';
import { UploadKakfaProducerService } from '../services/upload/upload-kafka-producer.service';
import { VideoProcessorService } from '../services/video-processor/video-processor.service';

export interface IVideoTranscodeData {
  videoId: number;
  fileKey: string;
}

@Processor(VIDEO_TRANSCODE_QUEUE, {
  concurrency: TRANSCODE_WORKER_CONCURRENCY,
})
@Injectable()
export class VideoTranscodeProcessor extends GenericWorkerHost<
  IVideoTranscodeData,
  void
> {
  private readonly videoRepository: GenericCrudRepository<Videos>;

  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    private readonly videoProcessorService: VideoProcessorService,
    private readonly kafkaProducer: UploadKakfaProducerService,
    private readonly bullQueueService: BullQueueService,
  ) {
    super(VIDEO_TRANSCODE_QUEUE, VideoTranscodeProcessor.name);
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
  }

  protected getJobContext(job: Job<IVideoTranscodeData>): string {
    return `, videoId=${job.data.videoId}, fileKey=${job.data.fileKey}`;
  }

  protected async processJob(job: Job<IVideoTranscodeData>): Promise<void> {
    const { videoId, fileKey } = job.data;

    try {
      // Use the existing processVideo method
      await this.videoProcessorService.processVideo(videoId, fileKey);

      this.logger.log(`✅ Successfully transcoded video: videoId=${videoId}`);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to transcode video: videoId=${videoId}, attempt=${job.attemptsMade + 1}`,
        error.stack,
      );

      // If this is the final attempt, send to DLQ and emit failure event
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.handleFailure(job, error, 'transcode');
      }

      throw error;
    }
  }

  /**
   * Handle job failure: send to DLQ and emit video.failed event
   */
  private async handleFailure(
    job: Job<IVideoTranscodeData>,
    error: Error,
    stage: 'transcode' | 'transcribe',
  ): Promise<void> {
    const { videoId, fileKey } = job.data;

    this.logger.error(
      `💀 Job exhausted all retries: videoId=${videoId}, stage=${stage}, sending to DLQ`,
    );

    // Send to Dead Letter Queue
    await this.bullQueueService.addJob(VIDEO_TRANSCODE_DLQ, `failed_${stage}`, {
      videoId,
      fileKey,
      stage,
      error: {
        message: error.message,
        stack: error.stack,
      },
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade + 1,
      jobId: job.id,
    });

    // Emit video.failed event
    await this.kafkaProducer.publishVideoFailed(videoId, stage, error.message, {
      fileKey,
      attempts: job.attemptsMade + 1,
      jobId: job.id,
    });
  }
}
