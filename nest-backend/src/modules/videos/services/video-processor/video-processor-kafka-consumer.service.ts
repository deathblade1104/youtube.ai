import { Controller, Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedMessage } from '../../../../database/postgres/entities/processed-message.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import { BullQueueService } from '../../../../providers/bullmq/bullmq.service';
import {
  TRANSCODE_VIDEO_JOB,
  VIDEO_TRANSCODE_QUEUE,
} from '../../constants/video-processor.constants';
import {
  VideoTranscodedPayload,
  VideoUploadedPayload,
} from '../upload/upload-kafka-producer.service';

@Controller()
@Injectable()
export class VideoProcessorKafkaConsumerController {
  private readonly logger = new Logger(
    VideoProcessorKafkaConsumerController.name,
  );
  private readonly processedMessageRepository: GenericCrudRepository<ProcessedMessage>;

  constructor(
    private readonly bullQueueService: BullQueueService,
    @InjectRepository(ProcessedMessage)
    private readonly processedMessageRepo: Repository<ProcessedMessage>,
  ) {
    this.processedMessageRepository = new GenericCrudRepository(
      processedMessageRepo,
      ProcessedMessage.name,
    );
  }

  @EventPattern('video.uploaded')
  async handleVideoUploaded(
    @Payload() message: VideoUploadedPayload & { eventId?: string },
  ) {
    const { id, eventId, videoId, fileKey, correlationId } = message;
    const messageId = eventId || id; // Use eventId from outbox if present

    // Check idempotency: skip if already processed
    const alreadyProcessed =
      await this.processedMessageRepository.findOneOrNone({
        where: { id: messageId } as any,
      });

    if (alreadyProcessed) {
      this.logger.warn(
        `⏭️ Skipping duplicate message: eventId=${messageId}, videoId=${videoId}`,
      );
      return;
    }

    this.logger.log(
      `📥 Received video.uploaded event: id=${id}, eventId=${messageId}, videoId=${videoId}, fileKey=${fileKey}, correlationId=${correlationId}`,
    );

    try {
      // Queue transcode job instead of processing directly
      await this.bullQueueService.addJob(
        VIDEO_TRANSCODE_QUEUE,
        TRANSCODE_VIDEO_JOB,
        {
          videoId,
          fileKey,
        },
      );

      // Mark as processed for idempotency
      await this.processedMessageRepository.create({
        id: messageId,
        topic: 'video.uploaded',
      } as any);

      this.logger.log(
        `✅ Queued transcode job for video: videoId=${videoId}, eventId=${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to queue transcode job videoId=${videoId}, eventId=${messageId}:`,
        error,
      );
      // Don't rethrow - let Kafka handle retries or dead letter queue
    }
  }

  @EventPattern('video.transcoded')
  async handleVideoTranscoded(
    @Payload() message: VideoTranscodedPayload & { eventId?: string },
  ) {
    const { id, eventId, videoId, variants } = message;
    const messageId = eventId || id; // Use eventId from outbox if present

    // Check idempotency: skip if already processed
    const alreadyProcessed =
      await this.processedMessageRepository.findOneOrNone({
        where: { id: messageId } as any,
      });

    if (alreadyProcessed) {
      this.logger.warn(
        `⏭️ Skipping duplicate message: eventId=${messageId}, videoId=${videoId}`,
      );
      return;
    }

    this.logger.log(
      `📥 Received video.transcoded event: id=${id}, eventId=${messageId}, videoId=${videoId}, variants=${variants.length}`,
    );

    // NOTE: Transcription is now handled by Python backend via Kafka
    // Python backend will consume video.transcoded events and transcribe using OpenAI Whisper
    // We just mark this as processed to prevent duplicate processing
    try {
      // Mark as processed for idempotency
      await this.processedMessageRepository.create({
        id: messageId,
        topic: 'video.transcoded',
      } as any);

      this.logger.log(
        `✅ Marked video.transcoded as processed (Python backend will handle transcription): videoId=${videoId}, eventId=${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark video.transcoded as processed videoId=${videoId}, eventId=${messageId}:`,
        error,
      );
      // Don't rethrow - let Kafka handle retries or dead letter queue
    }
  }
}
