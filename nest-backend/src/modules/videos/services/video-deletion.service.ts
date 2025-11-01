import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AWSBucket } from '../../../common/enums/buckets.enum';
import { CONFIG } from '../../../common/enums/config.enums';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { IAwsConfig } from '../../../configs/aws.config';
import { Comment } from '../../../database/postgres/entities/comment.entity';
import { CommentLike } from '../../../database/postgres/entities/comment-like.entity';
import { VideoStatusLog } from '../../../database/postgres/entities/video-status-log.entity';
import { VideoSummary } from '../../../database/postgres/entities/video-summary.entity';
import { VideoTranscript } from '../../../database/postgres/entities/video-transcript.entity';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { S3Service } from '../../../providers/s3/s3.service';
import { UploadMetadata, UploadStatus } from '../entities/upload-metadata.entity';
import { Videos } from '../entities/video.entity';
import { VideoVariant } from '../../../database/postgres/entities/video-variant.entity';
import { VideoSearchIndexService } from './search/video-search-index.service';
import { VideoStatusLogService } from './shared/video-status-log.service';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';

@Injectable()
export class VideoDeletionService {
  private readonly s3: any;
  private readonly bucket: string;
  private readonly logger = new Logger(VideoDeletionService.name);
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly variantRepository: GenericCrudRepository<VideoVariant>;
  private readonly transcriptRepository: GenericCrudRepository<VideoTranscript>;
  private readonly summaryRepository: GenericCrudRepository<VideoSummary>;
  private readonly commentRepository: GenericCrudRepository<Comment>;
  private readonly statusLogRepository: GenericCrudRepository<VideoStatusLog>;
  private readonly uploadMetadataRepository: GenericCrudRepository<UploadMetadata>;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
    private readonly videoSearchIndexService: VideoSearchIndexService,
    private readonly statusLogService: VideoStatusLogService,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoVariant)
    private readonly variantRepo: Repository<VideoVariant>,
    @InjectRepository(VideoTranscript)
    private readonly transcriptRepo: Repository<VideoTranscript>,
    @InjectRepository(VideoSummary)
    private readonly summaryRepo: Repository<VideoSummary>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepo: Repository<CommentLike>,
    @InjectRepository(VideoStatusLog)
    private readonly statusLogRepo: Repository<VideoStatusLog>,
    @InjectRepository(UploadMetadata)
    private readonly uploadMetadataRepo: Repository<UploadMetadata>,
  ) {
    this.s3 = s3Service.getS3Client();
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);
    this.bucket = awsConfig.buckets[AWSBucket.YOUTUBE];
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.variantRepository = new GenericCrudRepository(variantRepo, VideoVariant.name);
    this.transcriptRepository = new GenericCrudRepository(transcriptRepo, VideoTranscript.name);
    this.summaryRepository = new GenericCrudRepository(summaryRepo, VideoSummary.name);
    this.commentRepository = new GenericCrudRepository(commentRepo, Comment.name);
    this.statusLogRepository = new GenericCrudRepository(statusLogRepo, VideoStatusLog.name);
    this.uploadMetadataRepository = new GenericCrudRepository(
      uploadMetadataRepo,
      UploadMetadata.name,
    );
  }

  /**
   * Delete or cancel a video (handles both in-progress uploads and existing videos)
   * Performs complete cleanup: S3 files, database records, search index
   */
  async deleteVideo(videoId: number, userId: number): Promise<void> {
    this.logger.log(`🗑️ Starting video deletion: videoId=${videoId}, userId=${userId}`);

    return await this.dataSource.transaction(async (transactionalManager) => {
      // 1. Verify video exists and user owns it
      const video = await transactionalManager.findOne(Videos, {
        where: { id: videoId } as any,
      });

      if (!video) {
        throw new NotFoundException(`Video ${videoId} not found`);
      }

      if (video.user_id !== userId) {
        throw new ForbiddenException('You can only delete your own videos');
      }

      this.logger.log(`✅ Video ${videoId} ownership verified. Status: ${video.status}`);

      // 2. If video is in pending/uploading state, abort any multipart uploads
      if (
        video.status === VideoProcessingStatus.PENDING ||
        video.status === VideoProcessingStatus.UPLOADING
      ) {
        this.logger.log(`🔄 Checking for in-progress uploads for video ${videoId}...`);
        await this.abortInProgressUploads(video.key);
      }

      // 3. Delete all S3 objects associated with the video
      this.logger.log(`☁️ Deleting S3 objects for video ${videoId}...`);
      await this.deleteS3Objects(videoId, video.key);

      // 4. Delete all related database records
      this.logger.log(`💾 Deleting database records for video ${videoId}...`);
      await this.deleteDatabaseRecords(videoId, transactionalManager);

      // 5. Soft delete from search index
      try {
        this.logger.log(`🔍 Removing video ${videoId} from search index...`);
        await this.videoSearchIndexService.deleteVideo(videoId);
        this.logger.log(`✅ Video ${videoId} removed from search index`);
      } catch (error: any) {
        // Non-critical: log but don't fail
        this.logger.warn(`⚠️ Failed to remove video from search index: ${error.message}`);
      }

      // 6. Log status change (before deleting the video record)
      // Note: We log as 'failed' status since 'deleted' is not in the enum
      // This is logged before deletion, so the video still exists
      try {
        await this.statusLogService.logStatusChange(
          videoId,
          VideoProcessingStatus.FAILED,
          'nest-backend',
          `Video deleted by user ${userId}`,
          transactionalManager,
        );
      } catch (logError: any) {
        // Non-critical: log but continue
        this.logger.warn(`⚠️ Failed to log deletion status: ${logError.message}`);
      }

      this.logger.log(`✅ Video ${videoId} deletion completed successfully`);
    });
  }

  /**
   * Abort any in-progress multipart uploads for a given S3 key
   */
  private async abortInProgressUploads(s3Key: string): Promise<void> {
    try {
      // Find upload metadata with this key that are still in progress
      const uploadMetadata = await this.uploadMetadataRepository.findAll({
        where: {
          key: s3Key,
          status: UploadStatus.INITIALIZED,
        } as any,
      });

      for (const upload of uploadMetadata) {
        try {
          this.logger.log(`🔄 Aborting multipart upload: ${upload.upload_id}`);
          await this.s3.send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucket,
              Key: s3Key,
              UploadId: upload.upload_id,
            }),
          );

          // Update upload metadata status
          await this.uploadMetadataRepository.updateBy(
            { where: { id: upload.id } as any },
            { status: UploadStatus.ABORTED } as any,
          );

          this.logger.log(`✅ Aborted multipart upload: ${upload.upload_id}`);
        } catch (error: any) {
          // If upload doesn't exist, that's okay
          if (error.name === 'NoSuchUpload' || error.Code === 'NoSuchUpload') {
            this.logger.log(`ℹ️ Upload ${upload.upload_id} already aborted or doesn't exist`);
          } else {
            this.logger.warn(`⚠️ Failed to abort upload ${upload.upload_id}: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      this.logger.warn(`⚠️ Error checking for in-progress uploads: ${error.message}`);
    }
  }

  /**
   * Delete all S3 objects associated with a video
   */
  private async deleteS3Objects(videoId: number, videoKey: string): Promise<void> {
    const objectsToDelete: string[] = [];

    // 1. Original video file
    if (videoKey) {
      objectsToDelete.push(videoKey);
      // Also try the standard path format
      objectsToDelete.push(`videos/original/${videoId}.mp4`);
    }

    // 2. List and delete all HLS segments and playlists
    const hlsPrefix = `videos/hls/${videoId}/`;
    const hlsObjects = await this.listS3Objects(hlsPrefix);
    objectsToDelete.push(...hlsObjects);

    // 3. Transcript files
    objectsToDelete.push(`transcripts/${videoId}/transcript.json`);

    // 4. Summary files
    objectsToDelete.push(`summaries/${videoId}/summary.json`);
    objectsToDelete.push(`summaries/${videoId}/summary.txt`);

    // 5. Thumbnail (if exists, try common paths)
    objectsToDelete.push(`thumbnails/${videoId}.jpg`);
    objectsToDelete.push(`thumbnails/${videoId}.png`);

    // Delete all objects in batches (S3 DeleteObjects supports up to 1000 per request)
    const batches: string[][] = [];
    for (let i = 0; i < objectsToDelete.length; i += 1000) {
      batches.push(objectsToDelete.slice(i, i + 1000));
    }

    for (const batch of batches) {
      try {
        // Filter out empty keys
        const validKeys = batch.filter((key) => key && key.trim().length > 0);

        if (validKeys.length === 0) {
          continue;
        }

        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: validKeys.map((Key) => ({ Key })),
              Quiet: true, // Don't return errors for individual objects
            },
          }),
        );

        this.logger.log(`✅ Deleted ${validKeys.length} S3 objects`);
      } catch (error: any) {
        this.logger.warn(`⚠️ Error deleting S3 objects batch: ${error.message}`);
      }
    }
  }

  /**
   * List all S3 objects with a given prefix
   */
  private async listS3Objects(prefix: string): Promise<string[]> {
    const objects: string[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response = await this.s3.send(command);

        if (response.Contents) {
          objects.push(...response.Contents.map((obj) => obj.Key || '').filter(Boolean));
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      this.logger.log(`📋 Found ${objects.length} S3 objects with prefix: ${prefix}`);
    } catch (error: any) {
      this.logger.warn(`⚠️ Error listing S3 objects with prefix ${prefix}: ${error.message}`);
    }

    return objects;
  }

  /**
   * Delete all database records associated with a video
   */
  private async deleteDatabaseRecords(
    videoId: number,
    transactionalManager: any,
  ): Promise<void> {
    // Get video key before deleting
    const video = await transactionalManager.findOne(Videos, {
      where: { id: videoId } as any,
    });
    const videoKey = video?.key;

    // 1. Get all comment IDs first
    const comments = await transactionalManager.find(Comment, {
      where: { video_id: videoId } as any,
    });
    const commentIds = comments.map((c: Comment) => c.id);

    // 2. Delete comment likes (must be before comments due to FK)
    if (commentIds.length > 0) {
      await transactionalManager.delete(CommentLike, {
        comment_id: In(commentIds) as any,
      });
      this.logger.log(`🗑️ Deleted ${commentIds.length} comment likes`);
    }

    // 3. Delete comments
    await transactionalManager.delete(Comment, {
      video_id: videoId,
    });
    this.logger.log(`🗑️ Deleted comments for video ${videoId}`);

    // 4. Delete video variants
    await transactionalManager.delete(VideoVariant, { video_id: videoId });
    this.logger.log(`🗑️ Deleted video variants for video ${videoId}`);

    // 5. Delete transcript
    await transactionalManager.delete(VideoTranscript, { video_id: videoId });
    this.logger.log(`🗑️ Deleted transcript for video ${videoId}`);

    // 6. Delete summary
    await transactionalManager.delete(VideoSummary, { video_id: videoId });
    this.logger.log(`🗑️ Deleted summary for video ${videoId}`);

    // 7. Delete status logs
    await transactionalManager.delete(VideoStatusLog, { video_id: videoId });
    this.logger.log(`🗑️ Deleted status logs for video ${videoId}`);

    // 8. Delete upload metadata (if any)
    if (videoKey) {
      await transactionalManager.delete(UploadMetadata, {
        key: videoKey,
      } as any);
      this.logger.log(`🗑️ Deleted upload metadata for video ${videoId}`);
    }

    // 9. Finally, delete the video itself
    await transactionalManager.delete(Videos, { id: videoId });
    this.logger.log(`🗑️ Deleted video record ${videoId}`);
  }
}

