import { Module } from '@nestjs/common';
import { KafkaModule } from '../../providers/infra/kafka/kafka.module';
import { S3Module } from '../../providers/infra/s3/s3.module';
import { UploadKakfaProducerService } from './upload-kafka-producer.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [S3Module, KafkaModule],
  controllers: [UploadController],
  providers: [UploadService, UploadKakfaProducerService],
})
export class UploadModule {}
