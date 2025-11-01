import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

export interface VideoUploadedPayload {
  id: string; // Event ID (UUID)
  videoId: number; // Database video ID
  userId: number;
  fileKey: string; // S3 key
  metadata: {
    filename: string;
    contentType: string;
    uploadId: string;
    location?: string;
  };
  correlationId: string; // Correlation ID for tracing
  messageId: string; // Message ID (UUID)
  ts: string; // ISO timestamp
}

export interface VideoTranscodedPayload {
  id: string; // Event ID (UUID)
  videoId: number;
  variants: Array<{
    resolution: string;
    fileKey: string;
    sizeBytes: number;
  }>;
  ts: string; // ISO timestamp
}

export interface VideoTranscribedPayload {
  id: string; // Event ID (UUID)
  videoId: number;
  transcriptFileKey: string;
  snippetCount: number; // Number of transcript segments
  ts: string; // ISO timestamp
}

export interface VideoFailedPayload {
  id: string; // Event ID (UUID)
  videoId: number;
  stage: 'transcode' | 'transcribe';
  error: string;
  metadata?: Record<string, any>;
  ts: string; // ISO timestamp
}

@Injectable()
export class UploadKakfaProducerService implements OnModuleInit {
  private readonly logger = new Logger(UploadKakfaProducerService.name);

  constructor(@Inject('KAFKA_PRODUCER') private readonly kafka: ClientKafka) {}

  async onModuleInit() {
    await this.kafka.connect();
  }

  async publishVideoUploaded(
    videoId: number,
    userId: number,
    fileKey: string,
    metadata: {
      filename: string;
      contentType: string;
      uploadId: string;
      location?: string;
    },
    correlationId?: string,
  ): Promise<boolean> {
    const payload: VideoUploadedPayload = {
      id: uuidv4(),
      videoId,
      userId,
      fileKey,
      metadata,
      correlationId: correlationId || uuidv4(),
      messageId: uuidv4(),
      ts: new Date().toISOString(),
    };

    this.logger.log(
      `📤 Publishing video.uploaded event: videoId=${videoId}, id=${payload.id}`,
    );
    await this.kafka.emit('video.uploaded', payload);
    this.logger.log(`✅ Video uploaded event published successfully`);
    return true;
  }

  async publishVideoTranscoded(
    videoId: number,
    variants: Array<{
      resolution: string;
      fileKey: string;
      sizeBytes: number;
    }>,
  ): Promise<boolean> {
    const payload: VideoTranscodedPayload = {
      id: uuidv4(),
      videoId,
      variants,
      ts: new Date().toISOString(),
    };

    this.logger.log(
      `📤 Publishing video.transcoded event: videoId=${videoId}, id=${payload.id}`,
    );
    await this.kafka.emit('video.transcoded', payload);
    this.logger.log(`✅ Video transcoded event published successfully`);
    return true;
  }

  async publishVideoTranscribed(
    videoId: number,
    transcriptFileKey: string,
    snippetCount: number,
  ): Promise<boolean> {
    const payload: VideoTranscribedPayload = {
      id: uuidv4(),
      videoId,
      transcriptFileKey,
      snippetCount,
      ts: new Date().toISOString(),
    };

    this.logger.log(
      `📤 Publishing video.transcribed event: videoId=${videoId}, id=${payload.id}`,
    );
    await this.kafka.emit('video.transcribed', payload);
    this.logger.log(`✅ Video transcribed event published successfully`);
    return true;
  }

  async publishVideoFailed(
    videoId: number,
    stage: 'transcode' | 'transcribe',
    error: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const payload: VideoFailedPayload = {
      id: uuidv4(),
      videoId,
      stage,
      error,
      metadata,
      ts: new Date().toISOString(),
    };

    this.logger.log(
      `📤 Publishing video.failed event: videoId=${videoId}, stage=${stage}, id=${payload.id}`,
    );
    await this.kafka.emit('video.failed', payload);
    this.logger.log(`✅ Video failed event published successfully`);
    return true;
  }
}

