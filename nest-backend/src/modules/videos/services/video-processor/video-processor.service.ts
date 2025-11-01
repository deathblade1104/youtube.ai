import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AWSBucket } from '../../../../common/enums/buckets.enum';
import { CONFIG } from '../../../../common/enums/config.enums';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { IAwsConfig } from '../../../../configs/aws.config';
import {
  VideoResolution,
  VideoVariant,
} from '../../../../database/postgres/entities/video-variant.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import {
  FfmpegService,
  TranscodeResult,
} from '../../../../providers/ffmpeg/ffmpeg.service';
import { S3Service } from '../../../../providers/s3/s3.service';
import { VIDEO_PROCESSOR_CONSTANTS } from '../../constants/video-processor.constants';
import { Videos } from '../../entities/video.entity';
import { OutboxService } from '../shared/outbox.service';
import { VideoStatusLogService } from '../shared/video-status-log.service';

@Injectable()
export class VideoProcessorService {
  private readonly logger = new Logger(VideoProcessorService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly videoVariantRepository: GenericCrudRepository<VideoVariant>;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly ffmpegService: FfmpegService,
    private readonly outboxService: OutboxService,
    private readonly statusLogService: VideoStatusLogService,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoVariant)
    private readonly videoVariantRepo: Repository<VideoVariant>,
  ) {
    this.s3 = s3Service.getS3Client();
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);
    this.bucket = awsConfig.buckets[AWSBucket.YOUTUBE];
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.videoVariantRepository = new GenericCrudRepository(
      videoVariantRepo,
      VideoVariant.name,
    );

    // Ensure temp directory exists
    this.ensureTempDirectory();
  }

  /**
   * Process video: download, transcode, upload variants, save to DB, emit event
   */
  async processVideo(videoId: number, fileKey: string): Promise<void> {
    this.logger.log(
      `🎬 Starting video processing: videoId=${videoId}, fileKey=${fileKey}`,
    );

    try {
      // 1. Verify video exists in database
      const video = await this.videoRepository.findOneOrNone({
        where: { id: videoId } as any,
      });

      if (!video) {
        throw new InternalServerErrorException(
          `Video not found in database: id=${videoId}`,
        );
      }

      this.logger.log(`📹 Verified video in DB: id=${videoId}`);

      // 2. Update status to TRANSCODING
      await this.videoRepository.updateBy(
        { where: { id: videoId } as any },
        { status: VideoProcessingStatus.TRANSCODING },
      );
      // Log status change
      await this.statusLogService
        .logStatusChange(
          videoId,
          VideoProcessingStatus.TRANSCODING,
          'nest-be',
          'Started video transcoding',
        )
        .catch((err) =>
          this.logger.warn(`Failed to log status: ${err.message}`),
        );

      // 3. Move original video to proper location if needed
      const originalS3Key = `videos/original/${videoId}.mp4`;
      if (fileKey !== originalS3Key) {
        await this.moveOriginalVideo(fileKey, originalS3Key, videoId);
      }

      // 4. Download original video from S3
      const originalVideoPath = await this.downloadOriginalVideo(
        originalS3Key,
        videoId,
      );

      try {
        // 5. Extract thumbnail from video
        await this.extractAndUploadThumbnail(originalVideoPath, videoId);

        // 6. Transcode to all variants
        const transcodedVariants = await this.transcodeAllVariants(
          originalVideoPath,
          videoId,
        );

        // 7. Upload variants to S3
        const uploadedVariants = await this.uploadVariants(
          transcodedVariants,
          videoId,
        );

        // 8. Save variants to database
        await this.saveVideoVariants(videoId, uploadedVariants);

        // 9. Cleanup temp files
        await this.cleanupTempFiles(originalVideoPath, transcodedVariants);

        // 10. Update status to TRANSCRIBING (Python backend will handle transcription)
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          { status: VideoProcessingStatus.TRANSCRIBING },
        );
        // Log status change
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.TRANSCRIBING,
            'nest-be',
            'Transcoding completed, Python backend will handle transcription',
          )
          .catch((err) =>
            this.logger.warn(`Failed to log status: ${err.message}`),
          );

        // 11. Emit video.transcoded event with variants via outbox (reliable publishing)
        const variants = uploadedVariants.map((variant) => ({
          resolution: variant.resolution,
          fileKey: variant.s3Key,
          sizeBytes: variant.sizeBytes,
        }));

        // Write to outbox instead of direct Kafka publish
        await this.outboxService.addToOutbox(
          'video.transcoded',
          {
            id: uuidv4(),
            videoId,
            variants,
            ts: new Date().toISOString(),
          },
        );

        this.logger.log(
          `✅ Video processing completed successfully for video ${videoId}`,
        );
      } catch (error) {
        // Cleanup on error
        await this.cleanupTempFiles(originalVideoPath, []);

        // Update status to FAILED
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          {
            status: VideoProcessingStatus.FAILED,
            status_message:
              error instanceof Error ? error.message : 'Transcoding failed',
          },
        );
        // Log status change
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.FAILED,
            'nest-be',
            error instanceof Error ? error.message : 'Transcoding failed',
          )
          .catch((err) =>
            this.logger.warn(`Failed to log status: ${err.message}`),
          );

        throw error;
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process video videoId=${videoId}, fileKey=${fileKey}:`,
        error,
      );

      // Update status to FAILED if not already updated
      try {
        await this.videoRepository.updateBy(
          { where: { id: videoId } as any },
          {
            status: VideoProcessingStatus.FAILED,
            status_message:
              error instanceof Error
                ? error.message
                : 'Video processing failed',
          },
        );
        // Log status change
        await this.statusLogService
          .logStatusChange(
            videoId,
            VideoProcessingStatus.FAILED,
            'nest-be',
            error instanceof Error ? error.message : 'Video processing failed',
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
   * Move original video to proper S3 location
   */
  private async moveOriginalVideo(
    sourceKey: string,
    destinationKey: string,
    videoId: number,
  ): Promise<void> {
    this.logger.log(
      `📦 Moving original video from ${sourceKey} to ${destinationKey}`,
    );

    try {
      // Copy object to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
        ContentType: 'video/mp4',
      });

      await this.s3.send(copyCommand);
      this.logger.debug(`✅ Copied video to ${destinationKey}`);

      // Update video key in database first (before deleting original)
      // Use videoId for safer update (more reliable than key matching)
      await this.videoRepository.updateBy(
        { where: { id: videoId } as any },
        { key: destinationKey },
      );
      this.logger.debug(`✅ Updated video key in database`);

      // Delete original only after successful copy and DB update
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: sourceKey,
      });

      await this.s3.send(deleteCommand);
      this.logger.debug(`✅ Deleted original video from ${sourceKey}`);

      this.logger.log(
        `✅ Moved original video to ${destinationKey} and updated DB`,
      );
    } catch (error) {
      this.logger.error(`Failed to move original video: ${error}`);
      throw new InternalServerErrorException('Failed to move original video');
    }
  }

  /**
   * Download original video from S3
   */
  private async downloadOriginalVideo(
    s3Key: string,
    videoId: number,
  ): Promise<string> {
    this.logger.log(`⬇️ Downloading original video from S3: ${s3Key}`);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });

      const response = await this.s3.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException('Empty response body from S3');
      }

      const tempDir = path.join(
        VIDEO_PROCESSOR_CONSTANTS.TEMP_DIR,
        `video-${videoId}`,
      );
      await fs.mkdir(tempDir, { recursive: true });

      const localPath = path.join(tempDir, `original.mp4`);
      const chunks: Uint8Array[] = [];

      // Convert stream to buffer
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      await fs.writeFile(localPath, buffer);

      this.logger.log(`✅ Downloaded original video to ${localPath}`);
      return localPath;
    } catch (error) {
      this.logger.error(`Failed to download video from S3: ${error}`);
      throw new InternalServerErrorException(
        'Failed to download video from S3',
      );
    }
  }

  /**
   * Extract and upload thumbnail from video
   */
  private async extractAndUploadThumbnail(
    videoPath: string,
    videoId: number,
  ): Promise<void> {
    try {
      this.logger.log(`🖼️ Extracting thumbnail for video ${videoId}`);

      const tempThumbnailPath = path.join(
        VIDEO_PROCESSOR_CONSTANTS.TEMP_DIR,
        `video-${videoId}`,
        'thumbnail.jpg',
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(tempThumbnailPath), { recursive: true });

      // Extract thumbnail using FFmpeg (at 1 second mark)
      await this.ffmpegService.extractThumbnail(
        videoPath,
        tempThumbnailPath,
        1,
      );

      // Upload thumbnail to S3
      const thumbnailKey = `videos/thumbnails/${videoId}.jpg`;
      const thumbnailBuffer = await fs.readFile(tempThumbnailPath);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      });

      await this.s3.send(command);

      this.logger.log(
        `✅ Thumbnail uploaded to S3: ${thumbnailKey} for video ${videoId}`,
      );

      // Cleanup temp thumbnail file
      try {
        await fs.unlink(tempThumbnailPath);
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp thumbnail: ${cleanupError}`);
      }
    } catch (error) {
      // Don't fail the entire processing if thumbnail extraction fails
      this.logger.warn(
        `Failed to extract/upload thumbnail for video ${videoId}: ${error}`,
      );
    }
  }

  /**
   * Transcode video to all variants with HLS segmentation
   */
  private async transcodeAllVariants(
    originalPath: string,
    videoId: number,
  ): Promise<
    Array<
      TranscodeResult & {
        resolution: VideoResolution;
        playlistPath: string;
        segmentCount: number;
        segmentPaths: string[];
      }
    >
  > {
    this.logger.log(`🎬 Starting HLS transcoding for video ${videoId}`);

    const variants: VideoResolution[] = [
      VideoResolution.P1080,
      VideoResolution.P720,
      VideoResolution.P480,
      VideoResolution.P360,
    ];

    const results: Array<
      TranscodeResult & {
        resolution: VideoResolution;
        playlistPath: string;
        segmentCount: number;
        segmentPaths: string[];
      }
    > = [];

    for (const resolution of variants) {
      try {
        const outputDir = path.join(
          VIDEO_PROCESSOR_CONSTANTS.TEMP_DIR,
          `video-${videoId}`,
          resolution,
        );

        const playlistName = 'playlist.m3u8';

        // Transcode and segment to HLS format
        const hlsResult = await this.ffmpegService.transcodeToHLS({
          inputPath: originalPath,
          outputDir,
          playlistName,
          resolution,
          segmentDuration: 10, // 10-second segments
        });

        // Read all segment files
        const segmentFiles = await fs.readdir(outputDir);
        const segmentPaths = segmentFiles
          .filter((file) => file.endsWith('.ts'))
          .sort() // Ensure segments are in order
          .map((file) => path.join(outputDir, file));

        // Calculate total size of all segments
        let totalSize = 0;
        for (const segmentPath of segmentPaths) {
          const stats = await fs.stat(segmentPath);
          totalSize += stats.size;
        }

        // Get playlist file size
        const playlistStats = await fs.stat(hlsResult.playlistPath);
        totalSize += playlistStats.size;

        results.push({
          outputPath: hlsResult.playlistPath, // Keep for compatibility
          width: hlsResult.width,
          height: hlsResult.height,
          bitrate: hlsResult.bitrate,
          sizeBytes: totalSize,
          duration: hlsResult.duration,
          resolution,
          playlistPath: hlsResult.playlistPath,
          segmentCount: hlsResult.segmentCount,
          segmentPaths,
        });

        this.logger.log(
          `✅ HLS transcoding completed for ${resolution}: ${hlsResult.segmentCount} segments`,
        );
      } catch (error) {
        this.logger.error(`Failed to transcode to ${resolution}: ${error}`);
        // Continue with other variants even if one fails
      }
    }

    this.logger.log(
      `✅ HLS transcoding completed: ${results.length}/${variants.length} variants`,
    );
    return results;
  }

  /**
   * Upload HLS variants (segments and playlists) to S3
   */
  private async uploadVariants(
    variants: Array<
      TranscodeResult & {
        resolution: VideoResolution;
        playlistPath: string;
        segmentCount: number;
        segmentPaths: string[];
      }
    >,
    videoId: number,
  ): Promise<
    Array<
      TranscodeResult & {
        s3Key: string;
        resolution: VideoResolution;
        playlistS3Key: string;
        segmentS3Keys: string[];
      }
    >
  > {
    this.logger.log(
      `⬆️ Uploading ${variants.length} HLS variants (segments + playlists) to S3`,
    );

    const uploaded: Array<
      TranscodeResult & {
        s3Key: string;
        resolution: VideoResolution;
        playlistS3Key: string;
        segmentS3Keys: string[];
      }
    > = [];

    for (const variant of variants) {
      try {
        const resolution = variant.resolution;
        const segmentS3Keys: string[] = [];

        // 1. Upload all segments first
        for (let i = 0; i < variant.segmentPaths.length; i++) {
          const segmentPath = variant.segmentPaths[i];
          const segmentFilename = `segment_${String(i).padStart(3, '0')}.ts`;
          const segmentS3Key = `videos/hls/${videoId}/${resolution}/${segmentFilename}`;

          const segmentBuffer = await fs.readFile(segmentPath);

          await this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: segmentS3Key,
              Body: segmentBuffer,
              ContentType: 'video/mp2t', // MIME type for .ts files
            }),
          );

          segmentS3Keys.push(segmentS3Key);
        }

        // 2. Read and update playlist to use relative segment paths
        const playlistContent = await fs.readFile(variant.playlistPath, 'utf-8');
        // FFmpeg generates playlist with relative paths, which is perfect for S3
        // We'll keep the relative paths as-is since they'll work with S3 URLs

        // 3. Upload playlist
        const playlistS3Key = `videos/hls/${videoId}/${resolution}/playlist.m3u8`;

        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: playlistS3Key,
            Body: Buffer.from(playlistContent, 'utf-8'),
            ContentType: 'application/vnd.apple.mpegurl',
            CacheControl: 'public, max-age=3600',
          }),
        );

        // Keep s3Key for backward compatibility (points to playlist)
        uploaded.push({
          ...variant,
          s3Key: playlistS3Key, // Main reference is the playlist
          playlistS3Key,
          segmentS3Keys,
          resolution: resolution as VideoResolution,
        });

        this.logger.log(
          `✅ Uploaded ${resolution} HLS variant: playlist + ${variant.segmentCount} segments`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to upload variant ${variant.resolution}: ${error}`,
        );
        // Continue with other variants
      }
    }

    return uploaded;
  }

  /**
   * Save video variants to database
   */
  private async saveVideoVariants(
    videoId: number,
    variants: Array<
      TranscodeResult & {
        s3Key: string;
        resolution: VideoResolution;
        playlistS3Key: string;
        segmentS3Keys: string[];
      }
    >,
  ): Promise<void> {
    this.logger.log(`💾 Saving ${variants.length} HLS variants to database`);

    for (const variant of variants) {
      try {
        // Store the playlist key (main reference for HLS)
        await this.videoVariantRepository.create({
          video_id: videoId,
          resolution: variant.resolution,
          key: variant.playlistS3Key, // Store playlist key (not segment keys)
          width: variant.width,
          height: variant.height,
          bitrate: variant.bitrate,
          size_bytes: variant.sizeBytes,
        } as any);

        this.logger.log(
          `✅ Saved ${variant.resolution} HLS variant to database (playlist: ${variant.playlistS3Key}, segments: ${variant.segmentS3Keys.length})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to save variant ${variant.resolution} to database: ${error}`,
        );
        // Continue with other variants
      }
    }
  }

  /**
   * Cleanup temporary files (HLS segments and playlists)
   */
  private async cleanupTempFiles(
    originalPath: string,
    variantPaths: Array<
      TranscodeResult & {
        resolution: VideoResolution;
        playlistPath: string;
        segmentPaths: string[];
      }
    >,
  ): Promise<void> {
    try {
      if (!originalPath) {
        return;
      }

      const tempDir = path.dirname(originalPath);

      // Check if directory exists before attempting cleanup
      try {
        await fs.access(tempDir);
      } catch {
        // Directory doesn't exist, nothing to clean
        return;
      }

      // Use fs.rm with recursive option (Node.js 14.18+)
      // This is safer and more efficient than removing files individually
      await fs.rm(tempDir, { recursive: true, force: true });

      this.logger.log(`🧹 Cleaned up temp files from ${tempDir}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp files: ${error}`);
      // Don't throw - cleanup is best-effort
    }
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(VIDEO_PROCESSOR_CONSTANTS.TEMP_DIR, { recursive: true });
    } catch (error) {
      this.logger.warn(`Failed to create temp directory: ${error}`);
    }
  }
}
