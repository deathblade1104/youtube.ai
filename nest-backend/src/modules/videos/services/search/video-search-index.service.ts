import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { OpensearchService } from '../../../../database/opensearch/opensearch.service';
import { VideoSummary } from '../../../../database/postgres/entities/video-summary.entity';
import { VideoTranscript } from '../../../../database/postgres/entities/video-transcript.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import { VIDEO_SEARCH_INDEX as INDEX_NAME } from '../../constants/search.constants';
import { Videos } from '../../entities/video.entity';
import { IVideoSearchDocument } from '../../interfaces/video-search-document.interface';
import { VIDEO_SEARCH_INDEX_MAPPING } from '../../schemas/video-search-schema';
import { VideoStatusLogService } from '../shared/video-status-log.service';

@Injectable()
export class VideoSearchIndexService {
  private readonly logger = new Logger(VideoSearchIndexService.name);
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly videoTranscriptRepository: GenericCrudRepository<VideoTranscript>;
  private readonly videoSummaryRepository: GenericCrudRepository<VideoSummary>;

  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoTranscript)
    private readonly transcriptRepo: Repository<VideoTranscript>,
    @InjectRepository(VideoSummary)
    private readonly summaryRepo: Repository<VideoSummary>,
    private readonly opensearchService: OpensearchService,
    private readonly statusLogService: VideoStatusLogService,
  ) {
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.videoTranscriptRepository = new GenericCrudRepository(
      transcriptRepo,
      VideoTranscript.name,
    );
    this.videoSummaryRepository = new GenericCrudRepository(
      summaryRepo,
      VideoSummary.name,
    );
  }

  /**
   * Initialize video search index if it doesn't exist
   */
  async initializeIndex(): Promise<void> {
    try {
      const created = await this.opensearchService.createIndex({
        indexName: INDEX_NAME,
        settings: VIDEO_SEARCH_INDEX_MAPPING.settings,
        mappings: VIDEO_SEARCH_INDEX_MAPPING.mappings,
      });

      if (created) {
        this.logger.log(`✅ Created OpenSearch index: ${INDEX_NAME}`);
      } else {
        this.logger.log(`ℹ️ OpenSearch index ${INDEX_NAME} already exists`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize OpenSearch index: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Index a video document to OpenSearch
   */
  async indexVideo(videoId: number): Promise<void> {
    try {
      // Fetch video from database
      const video = await this.videoRepository.findOneOrNone({
        where: { id: videoId } as any,
      });

      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Fetch related transcript and summary
      const transcript = await this.videoTranscriptRepository.findOneOrNone({
        where: { video_id: videoId } as any,
      });

      const summary = await this.videoSummaryRepository.findOneOrNone({
        where: { video_id: videoId } as any,
      });

      // Build search document (only relevant fields for search)
      const searchDoc: IVideoSearchDocument = {
        video_id: video.id,
        title: video.title,
        description: video.description,
        user_id: video.user_id,
        user_name: video.user_name,
        summary_text: summary?.summary_text || undefined,
        transcript_snippet: transcript?.transcript_text
          ? transcript.transcript_text.substring(0, 500)
          : undefined,
        created_at: video.created_at.toISOString(),
      };

      // Check if video is already in READY status (re-indexing scenario)
      const isReindexing = video.status === VideoProcessingStatus.READY;

      // Only update status to INDEXING if video is not already READY
      // This prevents unnecessary status changes when re-indexing already-ready videos
      if (!isReindexing) {
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          { status: VideoProcessingStatus.INDEXING },
        );
        // Log status change only if we actually changed the status
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.INDEXING,
            'nest-be',
            'Starting OpenSearch indexing',
          )
          .catch((err) =>
            this.logger.warn(`Failed to log status: ${err.message}`),
          );
      } else {
        // For re-indexing, just log a debug message (no status change)
        this.logger.debug(
          `Re-indexing video ${videoId} (already READY, skipping status change)`,
        );
      }

      // Index to OpenSearch
      await this.opensearchService.bulkCreateDocs({
        index: INDEX_NAME,
        docs: [
          {
            id: videoId.toString(),
            body: searchDoc,
          },
        ],
      });

      // Update status to READY after successful indexing (only if it wasn't already READY)
      if (!isReindexing) {
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          {
            status: VideoProcessingStatus.READY,
            processed_at: new Date(),
          },
        );
        // Log status change only if we actually changed the status
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.READY,
            'nest-be',
            'Video fully processed and indexed',
          )
          .catch((err) =>
            this.logger.warn(`Failed to log status: ${err.message}`),
          );
      } else {
        // For re-indexing, ensure processed_at is set but don't change status or log
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          {
            processed_at: new Date(),
          },
        );
      }

      this.logger.log(`✅ Indexed video ${videoId} to OpenSearch`);
    } catch (error: any) {
      this.logger.error(
        `Failed to index video ${videoId}: ${error.message}`,
        error.stack,
      );

      // Update status to FAILED on error
      try {
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          {
            status: VideoProcessingStatus.FAILED,
            status_message: error.message || 'Indexing failed',
          },
        );
        // Log status change
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.FAILED,
            'nest-be',
            error.message || 'Indexing failed',
          )
          .catch((err) =>
            this.logger.warn(`Failed to log status: ${err.message}`),
          );
      } catch (updateError) {
        this.logger.warn(`Failed to update video status: ${updateError}`);
      }

      throw error;
    }
  }

  /**
   * Update video document in OpenSearch
   */
  async updateVideo(videoId: number): Promise<void> {
    // Re-index the video
    await this.indexVideo(videoId);
  }

  /**
   * Delete video from OpenSearch
   * Note: Currently marks video as deleted by updating status
   * Full document deletion can be implemented in OpensearchService.deleteDocument() if needed
   */
  async deleteVideo(videoId: number): Promise<void> {
    try {
      this.logger.log(`Deleting video ${videoId} from OpenSearch`);
      // Update video status to mark as deleted instead of removing from index
      // This preserves history and allows for soft-delete patterns
      const success = await this.opensearchService.updateDoc<{ status: string; deleted_at: string }>({
        index: INDEX_NAME,
        id: videoId.toString(),
        body: {
          doc: {
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          },
        },
      });

      if (success) {
        this.logger.log(`✅ Marked video ${videoId} as deleted in OpenSearch`);
      } else {
        // Document might not exist in index (e.g., never indexed or already deleted)
        // This is not a critical error - log it but don't fail
        this.logger.warn(
          `⚠️ Video ${videoId} not found in OpenSearch index (may not have been indexed or already deleted)`,
        );
      }
    } catch (error: any) {
      // Check if it's a document_missing_exception
      if (
        error?.error?.type === 'document_missing_exception' ||
        error?.message?.includes('document missing')
      ) {
        // Document doesn't exist - consider it already deleted
        this.logger.log(
          `ℹ️ Video ${videoId} not found in OpenSearch (already deleted or never indexed)`,
        );
        return; // Don't throw - this is not an error
      }

      // For other errors, log but don't fail the deletion process
      this.logger.warn(
        `⚠️ Failed to mark video ${videoId} as deleted in OpenSearch: ${error.message || error}`,
      );
      // Don't throw - OpenSearch deletion is best-effort, main deletion should continue
    }
  }
}
