import { Controller, Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { BullQueueService } from '../../../../providers/bullmq/bullmq.service';
import {
  INDEX_VIDEO_JOB,
  VIDEO_SEARCH_INDEX_QUEUE,
} from '../../constants/search.constants';

export interface VideoSummarizedPayload {
  id: string;
  videoId: number;
  summaryFileKey?: string;
  summaryText?: string;
  ts: string;
}

@Controller()
@Injectable()
export class SearchKafkaConsumerController {
  private readonly logger = new Logger(SearchKafkaConsumerController.name);

  constructor(private readonly bullQueueService: BullQueueService) {}

  @EventPattern('video.summarized')
  async handleVideoSummarized(
    @Payload() message: VideoSummarizedPayload & { eventId?: string },
  ) {
    const { id, eventId, videoId, summaryText } = message;
    const messageId = eventId || id;

    this.logger.log(
      `📥 Received video.summarized event: id=${id}, eventId=${messageId}, videoId=${videoId}`,
    );

    try {
      // Queue indexing job
      await this.bullQueueService.addJob(
        VIDEO_SEARCH_INDEX_QUEUE,
        INDEX_VIDEO_JOB,
        {
          videoId,
        },
      );

      this.logger.log(
        `✅ Queued index job for video: videoId=${videoId}, eventId=${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to queue index job videoId=${videoId}, eventId=${messageId}:`,
        error,
      );
      // Don't rethrow - let Kafka handle retries or dead letter queue
    }
  }
}

