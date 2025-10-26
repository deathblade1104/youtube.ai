import { Module } from '@nestjs/common';
import { KafkaModule } from '../../providers/kafka/kafka.module';
import { S3Module } from '../../providers/s3/s3.module';
import { Videos } from './entities/video.entity';
import { UploadKakfaProducerService } from './upload-kafka-producer.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Videos]), S3Module, KafkaModule],
  controllers: [UploadController],
  providers: [UploadService, UploadKakfaProducerService],
})
export class UploadModule {}
