import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class UploadKakfaProducerService implements OnModuleInit {
  constructor(@Inject('KAFKA_PRODUCER') private readonly kafka: ClientKafka) {}

  async onModuleInit() {
    await this.kafka.connect();
  }

  async publishVideoUploaded(videoId: string, filePath: string) {
    await this.kafka.emit('video.uploaded', {
      videoId,
      filePath,
      uploadedAt: new Date().toISOString(),
    });
    return true;
  }
}
