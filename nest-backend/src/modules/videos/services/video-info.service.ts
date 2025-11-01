import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AWSBucket } from '../../../common/enums/buckets.enum';
import { CONFIG } from '../../../common/enums/config.enums';
import { IAwsConfig } from '../../../configs/aws.config';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { S3Service } from '../../../providers/s3/s3.service';
import { Videos } from '../entities/video.entity';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class VideoInfoService {
  private readonly logger = new Logger(VideoInfoService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly userRepository: GenericCrudRepository<User>;

  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.s3 = s3Service.getS3Client();
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);
    this.bucket = awsConfig.buckets[AWSBucket.YOUTUBE];
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.userRepository = new GenericCrudRepository(userRepo, User.name);
  }

  /**
   * Get thumbnail presigned URL for a video
   */
  async getThumbnailUrl(videoId: number): Promise<string | null> {
    try {
      const thumbnailKey = `videos/thumbnails/${videoId}.jpg`;

      // Check if thumbnail exists in S3 before generating presigned URL
      try {
        await this.s3.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: thumbnailKey,
          }),
        );
      } catch (headError: any) {
        // If object doesn't exist (404/NoSuchKey), return null
        if (
          headError?.name === 'NotFound' ||
          headError?.$metadata?.httpStatusCode === 404 ||
          headError?.Code === 'NoSuchKey'
        ) {
          this.logger.debug(`Thumbnail not found for video ${videoId}`);
          return null;
        }
        // For other errors (permission, network, etc.), log and return null
        this.logger.warn(
          `Failed to check thumbnail existence for video ${videoId}: ${headError?.message || headError}`,
        );
        return null;
      }

      // Generate presigned URL if thumbnail exists
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: thumbnailKey,
      });

      const presignedUrl = await getSignedUrl(this.s3, command, {
        expiresIn: 3600, // 1 hour
      });

      return presignedUrl;
    } catch (error: any) {
      // Fallback error handling for URL generation failures
      this.logger.warn(
        `Failed to generate thumbnail URL for video ${videoId}: ${error?.message || error}`,
      );
      return null;
    }
  }

  /**
   * Get video info with uploader details
   */
  async getVideoInfo(videoId: number): Promise<{
    id: number;
    title: string;
    description: string;
    status: string;
    status_message: string | null;
    created_at: string;
    processed_at: string | null;
    user_name: string;
    uploader: {
      id: number;
      name: string;
      email: string | null;
    };
  }> {
    const video = await this.videoRepository.findOneOrNone({
      where: { id: videoId } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    // Get uploader/user info
    const uploader = await this.userRepository.findOneOrNone({
      where: { id: video.user_id } as any,
    });

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      status: video.status,
      status_message: video.status_message,
      created_at: video.created_at.toISOString(), // Convert to ISO string for API consistency
      processed_at: video.processed_at?.toISOString() || null,
      user_name: video.user_name,
      uploader: uploader
        ? {
            id: uploader.id,
            name: uploader.name,
            email: uploader.email,
          }
        : {
            id: video.user_id,
            name: video.user_name,
            email: null, // Email not stored in video entity
          },
    };
  }

  /**
   * Enhance video items with thumbnail URLs
   */
  async enhanceVideosWithThumbnails(
    videos: Videos[],
  ): Promise<Array<Videos & { thumbnail_url: string | null }>> {
    const enhanced = await Promise.all(
      videos.map(async (video) => {
        const thumbnailUrl = await this.getThumbnailUrl(video.id);
        return {
          ...video,
          thumbnail_url: thumbnailUrl,
        };
      }),
    );

    return enhanced;
  }

  /**
   * Get video processing status
   */
  async getVideoStatus(videoId: number): Promise<{
    id: number;
    status: string;
    status_message: string | null;
    created_at: string;
    processed_at: string | null;
  }> {
    const video = await this.videoRepository.findOneOrNone({
      where: { id: videoId } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    return {
      id: video.id,
      status: video.status,
      status_message: video.status_message,
      created_at: video.created_at.toISOString(),
      processed_at: video.processed_at?.toISOString() || null,
    };
  }
}

