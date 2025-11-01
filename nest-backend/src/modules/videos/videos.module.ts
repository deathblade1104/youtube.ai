import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpensearchModule } from '../../database/opensearch/opensearch.module';
import { OutboxEvent } from '../../database/postgres/entities/outbox-event.entity';
import { ProcessedMessage } from '../../database/postgres/entities/processed-message.entity';
import { Comment } from '../../database/postgres/entities/comment.entity';
import { CommentLike } from '../../database/postgres/entities/comment-like.entity';
import { VideoStatusLog } from '../../database/postgres/entities/video-status-log.entity';
import { VideoSummary } from '../../database/postgres/entities/video-summary.entity';
import { VideoTranscript } from '../../database/postgres/entities/video-transcript.entity';
import { VideoVariant } from '../../database/postgres/entities/video-variant.entity';
import { BullMQModule } from '../../providers/bullmq/bullmq.module';
import { FfmpegModule } from '../../providers/ffmpeg/ffmpeg.module';
import { KafkaModule } from '../../providers/kafka/kafka.module';
import { S3Module } from '../../providers/s3/s3.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import {
  INDEX_VIDEO_JOB_OPTIONS,
  VIDEO_SEARCH_INDEX_QUEUE,
} from './constants/search.constants';
import {
  OUTBOX_PUBLISHER_JOB_OPTIONS,
  OUTBOX_PUBLISHER_QUEUE,
  TRANSCODE_JOB_OPTIONS,
  VIDEO_TRANSCODE_DLQ,
  VIDEO_TRANSCODE_QUEUE,
} from './constants/video-processor.constants';
import { CommentsController } from './controllers/comments.controller';
import { SearchAutocompleteController } from './controllers/search-autocomplete.controller';
import { ThumbnailController } from './controllers/thumbnail.controller';
import { UploadController } from './controllers/upload.controller';
import { VideoStatusController } from './controllers/video-status.controller';
import { VideosController } from './controllers/videos.controller';
import { WatchController } from './controllers/watch.controller';
import { UploadMetadata } from './entities/upload-metadata.entity';
import { Videos } from './entities/video.entity';
import { OutboxPublisherProcessor } from './processors/outbox-publisher.processor';
import { VideoIndexProcessor } from './processors/video-index.processor';
import { VideoTranscodeProcessor } from './processors/video-transcode.processor';
import { OutboxPublisherScheduler } from './schedulers/outbox-publisher.scheduler';
import { SearchKafkaConsumerController } from './services/search/search-kafka-consumer.service';
import { VideoSearchIndexService } from './services/search/video-search-index.service';
import { VideoSearchInitService } from './services/search/video-search-init.service';
import { VideoSearchService } from './services/search/video-search.service';
import { OutboxService } from './services/shared/outbox.service';
import { VideoStatusEventService } from './services/shared/video-status-event.service';
import { VideoStatusLogService } from './services/shared/video-status-log.service';
import { UploadKakfaProducerService } from './services/upload/upload-kafka-producer.service';
import { UploadService } from './services/upload/upload.service';
import { CommentService } from './services/comments/comment.service';
import { VideoInfoService } from './services/video-info.service';
import { VideoProcessorKafkaConsumerController } from './services/video-processor/video-processor-kafka-consumer.service';
import { VideoProcessorService } from './services/video-processor/video-processor.service';
import { VideoWatchService } from './services/video-watch.service';
import { WatchService } from './services/watch/watch.service';
import { VideoDeletionService } from './services/video-deletion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Videos,
      UploadMetadata,
      VideoVariant,
      VideoTranscript,
      VideoSummary,
      VideoStatusLog,
      OutboxEvent,
      ProcessedMessage,
      User,
      Comment,
      CommentLike,
    ]),
    ScheduleModule.forRoot(),
    S3Module,
    FfmpegModule,
    KafkaModule,
    OpensearchModule,
    UserModule,
    AuthModule,
    BullMQModule.forFeature([
      {
        name: VIDEO_TRANSCODE_QUEUE,
        defaultJobOptions: TRANSCODE_JOB_OPTIONS,
      },
      {
        name: VIDEO_TRANSCODE_DLQ,
        defaultJobOptions: TRANSCODE_JOB_OPTIONS,
      },
      {
        name: OUTBOX_PUBLISHER_QUEUE,
        defaultJobOptions: OUTBOX_PUBLISHER_JOB_OPTIONS,
      },
      {
        name: VIDEO_SEARCH_INDEX_QUEUE,
        defaultJobOptions: INDEX_VIDEO_JOB_OPTIONS,
      },
    ]),
  ],
  controllers: [
    UploadController,
    WatchController,
    VideosController,
    VideoStatusController,
    VideoProcessorKafkaConsumerController,
    SearchKafkaConsumerController,
    SearchAutocompleteController,
    CommentsController,
    ThumbnailController,
  ],
  providers: [
    // Upload services
    UploadService,
    UploadKakfaProducerService,
    // Watch services
    WatchService,
    VideoWatchService,
    // Video info service
    VideoInfoService,
    // Comment service
    CommentService,
    // Video processor services
    VideoProcessorService,
    // Search services
    VideoSearchService,
    VideoSearchIndexService,
    VideoSearchInitService,
    // Shared services
    OutboxService,
    VideoStatusLogService,
    VideoStatusEventService,
    // Video deletion service
    VideoDeletionService,
    // Processors
    VideoTranscodeProcessor,
    VideoIndexProcessor,
    OutboxPublisherProcessor,
    // Schedulers
    OutboxPublisherScheduler,
  ],
  exports: [
    UploadKakfaProducerService,
    WatchService,
    VideoInfoService,
    VideoSearchService,
    VideoSearchIndexService,
    OutboxService,
  ],
})
export class VideosModule {}
