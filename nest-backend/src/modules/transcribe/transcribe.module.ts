import { Module } from '@nestjs/common';
import { TranscribeKakfaConsumerController } from './transcribe-kafka-consumer.service';

@Module({
  controllers: [TranscribeKakfaConsumerController],
  //providers: [TranscribeService],
})
export class TranscribeModule {}
