// src/transcribe.consumer.ts
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class TranscribeKakfaConsumerController {
  private readonly logger = new Logger(TranscribeKakfaConsumerController.name);

  @EventPattern('video.uploaded')
  async handleVideoUploaded(@Payload() message: any) {
    const data = message.value;
    this.logger.log(`📥 Received video.uploaded: ${JSON.stringify(data)}`);

    await new Promise((res) => setTimeout(res, 2000));
    this.logger.log(`✍️ Transcription complete for video ${data.videoId}`);
  }
}
