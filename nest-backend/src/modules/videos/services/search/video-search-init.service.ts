import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { OpensearchService } from '../../../../database/opensearch/opensearch.service';
import { BullQueueService } from '../../../../providers/bullmq/bullmq.service';
import {
  VIDEO_SEARCH_INDEX as INDEX_NAME,
  INDEX_VIDEO_JOB,
  VIDEO_SEARCH_INDEX_QUEUE,
} from '../../constants/search.constants';
import { Videos } from '../../entities/video.entity';
import { VideoSearchIndexService } from './video-search-index.service';

/**
 * Service to initialize OpenSearch index at server startup.
 * Similar to Bloom Filter initialization pattern.
 *
 * On startup:
 * 1. Check if index exists, create if it doesn't
 * 2. Queue videos that are ready but might not be indexed yet (non-blocking)
 *
 * Uses BullMQ for indexing to:
 * - Avoid blocking server startup
 * - Process videos in parallel (with concurrency)
 * - Enable automatic retries on failure
 * - Consistent with existing video processing patterns
 *
 * Note: We don't delete the index on every startup to avoid wiping search data.
 * Only recreate index if RECREATE_OPENSEARCH_INDEX=true env var is set.
 */
@Injectable()
export class VideoSearchInitService implements OnModuleInit {
  private readonly logger = new Logger(VideoSearchInitService.name);
  private readonly shouldRecreateIndex =
    process.env.RECREATE_OPENSEARCH_INDEX === 'true';

  constructor(
    private readonly opensearchService: OpensearchService,
    private readonly videoSearchIndexService: VideoSearchIndexService,
    private readonly bullQueueService: BullQueueService,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
  ) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing OpenSearch video search index...');

    try {
      // Step 1: Check if index exists
      const indexExists = await this.opensearchService.indexExists(INDEX_NAME);

      if (!indexExists) {
        // Index doesn't exist - create it
        this.logger.log(`📝 Creating new index ${INDEX_NAME}...`);
        await this.videoSearchIndexService.initializeIndex();
        this.logger.log(`✅ Index ${INDEX_NAME} created successfully`);

        // Queue all ready videos for indexing
        this.logger.log(
          '📚 Index was empty, queueing all ready videos for indexing...',
        );
        await this.queueAllVideosForReindexing();
      } else if (this.shouldRecreateIndex) {
        // Only delete/recreate if explicitly requested via env var
        this.logger.warn(
          `🗑️ RECREATE_OPENSEARCH_INDEX=true - deleting and recreating index ${INDEX_NAME}...`,
        );
        const deleted = await this.opensearchService.deleteIndex(INDEX_NAME);
        if (deleted) {
          this.logger.log(`✅ Deleted existing index ${INDEX_NAME}`);
        }
        this.logger.log(`📝 Creating new index ${INDEX_NAME}...`);
        await this.videoSearchIndexService.initializeIndex();
        this.logger.log(`✅ Index ${INDEX_NAME} recreated successfully`);

        // Queue all ready videos for re-indexing
        this.logger.log(
          '📚 Index recreated, queueing all ready videos for re-indexing...',
        );
        await this.queueAllVideosForReindexing();
      } else {
        // Index exists - just ensure it's properly configured and queue any missing videos
        this.logger.log(
          `ℹ️ Index ${INDEX_NAME} already exists, ensuring it's up to date...`,
        );
        // Try to create (will be no-op if exists and schema matches)
        await this.videoSearchIndexService.initializeIndex();

        // Queue videos that might not be indexed yet (optional - indexing happens via Kafka events anyway)
        // This is a safety net for videos that might have been missed
        this.logger.log('📚 Checking for videos that might need indexing...');
        await this.queueMissingVideosForIndexing();
      }

      this.logger.log('✅ OpenSearch index initialization completed');
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to initialize OpenSearch index: ${error.message}`,
        error.stack,
      );
      // Don't throw - allow server to start even if indexing fails
      // The index will be created on-demand when needed
    }
  }

  /**
   * Queue all existing videos for re-indexing in BullMQ
   * This is non-blocking and processes videos in parallel
   */
  private async queueAllVideosForReindexing(): Promise<void> {
    try {
      // Fetch all videos that are ready (have been processed)
      const videos = await this.videoRepo.find({
        where: {
          status: VideoProcessingStatus.READY,
        } as any,
        order: { id: 'ASC' } as any,
      });

      this.logger.log(
        `📊 Found ${videos.length} ready videos to queue for indexing`,
      );

      if (videos.length === 0) {
        this.logger.log('ℹ️ No videos to index');
        return;
      }

      // Queue videos for indexing (non-blocking, parallel processing)
      let queuedCount = 0;
      let errorCount = 0;

      for (const video of videos) {
        try {
          await this.bullQueueService.addJob(
            VIDEO_SEARCH_INDEX_QUEUE,
            INDEX_VIDEO_JOB,
            {
              videoId: video.id,
            },
          );
          queuedCount++;
          if (queuedCount % 50 === 0) {
            this.logger.log(
              `📈 Progress: ${queuedCount}/${videos.length} videos queued`,
            );
          }
        } catch (error: any) {
          errorCount++;
          this.logger.warn(
            `⚠️ Failed to queue video ${video.id}: ${error.message}`,
          );
          // Continue with next video
        }
      }

      this.logger.log(
        `✅ Queued ${queuedCount} videos for indexing (${errorCount} failed). Videos will be processed in parallel by BullMQ workers.`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error during video re-indexing queueing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Queue videos that might not be indexed yet (safety net)
   * This queues all READY videos - if they're already indexed, the indexing service
   * will handle it gracefully (bulkCreateDocs works with existing documents)
   */
  private async queueMissingVideosForIndexing(): Promise<void> {
    try {
      // Fetch all videos that are ready (have been processed)
      const videos = await this.videoRepo.find({
        where: {
          status: VideoProcessingStatus.READY,
        } as any,
        order: { id: 'ASC' } as any,
      });

      if (videos.length === 0) {
        this.logger.log('ℹ️ No ready videos to check for indexing');
        return;
      }

      this.logger.log(
        `📊 Found ${videos.length} ready videos, queueing for indexing (safety net - will skip if already indexed)...`,
      );

      // Queue videos for indexing (non-blocking, parallel processing)
      let queuedCount = 0;
      let errorCount = 0;

      for (const video of videos) {
        try {
          await this.bullQueueService.addJob(
            VIDEO_SEARCH_INDEX_QUEUE,
            INDEX_VIDEO_JOB,
            {
              videoId: video.id,
            },
          );
          queuedCount++;
        } catch (error: any) {
          errorCount++;
          this.logger.warn(
            `⚠️ Failed to queue video ${video.id}: ${error.message}`,
          );
          // Continue with next video
        }
      }

      if (queuedCount > 0) {
        this.logger.log(
          `✅ Queued ${queuedCount} videos for indexing (${errorCount} failed). Videos will be processed in parallel by BullMQ workers.`,
        );
      } else {
        this.logger.log('ℹ️ No videos queued (all may already be indexed)');
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error during missing video indexing queueing: ${error.message}`,
        error.stack,
      );
      // Don't throw - this is a safety net, not critical
    }
  }
}
