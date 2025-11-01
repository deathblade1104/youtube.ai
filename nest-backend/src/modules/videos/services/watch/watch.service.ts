import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AWSBucket } from '../../../../common/enums/buckets.enum';
import { CONFIG } from '../../../../common/enums/config.enums';
import { IAwsConfig } from '../../../../configs/aws.config';
import {
  VideoResolution,
  VideoVariant,
} from '../../../../database/postgres/entities/video-variant.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import { S3Service } from '../../../../providers/s3/s3.service';
import { Videos } from '../../entities/video.entity';

@Injectable()
export class WatchService {
  private readonly logger = new Logger(WatchService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly videoVariantRepository: GenericCrudRepository<VideoVariant>;

  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoVariant)
    private readonly variantRepo: Repository<VideoVariant>,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.s3 = s3Service.getS3Client();
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);
    this.bucket = awsConfig.buckets[AWSBucket.YOUTUBE];
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.videoVariantRepository = new GenericCrudRepository(
      variantRepo,
      VideoVariant.name,
    );
  }

  /**
   * Generate HLS manifest (.m3u8) for a video
   */
  async generateHLSManifest(
    videoId: number,
    baseUrl?: string,
    token?: string,
  ): Promise<string> {
    // Fetch video and variants
    const video = await this.videoRepository.findOneOrNone({
      where: { id: videoId },
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    const variants = await this.videoVariantRepository.findAll({
      where: { video_id: videoId } as any,
      order: { resolution: 'DESC' } as any, // Highest quality first
    });

    if (variants.length === 0) {
      throw new NotFoundException(
        `No video variants found for video ${videoId}`,
      );
    }

    // Generate HLS manifest content
    const manifest = this.buildHLSManifest(videoId, variants, baseUrl, token);

    return manifest;
  }

  /**
   * Build HLS master manifest string (points to variant playlists)
   */
  private buildHLSManifest(
    videoId: number,
    variants: VideoVariant[],
    baseUrl?: string,
    token?: string,
  ): string {
    let manifest = '#EXTM3U\n';
    manifest += '#EXT-X-VERSION:3\n';

    // Sort variants by resolution (highest first for HLS)
    const sortedVariants = [...variants].sort((a, b) => {
      const order = {
        [VideoResolution.P1080]: 4,
        [VideoResolution.P720]: 3,
        [VideoResolution.P480]: 2,
        [VideoResolution.P360]: 1,
      };
      return (order[b.resolution] || 0) - (order[a.resolution] || 0);
    });

    // Determine base URL for variant playlist paths
    const variantBaseUrl = baseUrl
      ? `${baseUrl}/api/v1/watch/hls/${videoId}`
      : `/api/v1/watch/hls/${videoId}`;

    // Add token to variant URLs if provided (for authentication)
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

    // Add variant playlist entries (each points to a .m3u8 playlist for that resolution)
    for (const variant of sortedVariants) {
      const bandwidth = this.estimateBandwidth(variant.resolution);
      const resolution = this.getResolutionString(variant.resolution);

      // Point to variant playlist, not variant directly
      manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
      manifest += `${variantBaseUrl}/variants/${variant.resolution}/playlist.m3u8${tokenParam}\n`;
    }

    return manifest;
  }

  /**
   * Get HLS variant playlist content
   * Returns the actual playlist content, updating segment URLs to be presigned
   */
  async getVariantPlaylistContent(
    videoId: number,
    resolution: VideoResolution,
    baseUrl?: string,
    token?: string,
  ): Promise<string> {
    const variant = await this.videoVariantRepository.findOneOrNone({
      where: { video_id: videoId, resolution } as any,
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant ${resolution} not found for video ${videoId}`,
      );
    }

    // Check if variant key points to an HLS playlist (.m3u8) or old MP4 format
    if (!variant.key.endsWith('.m3u8')) {
      throw new NotFoundException(
        `Video ${videoId} variant ${resolution} was processed before HLS implementation. Please re-upload the video to use HLS streaming.`,
      );
    }

    // Get the playlist content from S3
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: variant.key,
    });

    const response = await this.s3.send(command);

    // Check content type to ensure we got a playlist, not binary data
    const contentType = response.ContentType;
    if (!contentType || !contentType.includes('mpegurl') && !contentType.includes('text')) {
      this.logger.warn(
        `Unexpected content type for variant ${resolution} playlist: ${contentType}. Key: ${variant.key}`,
      );
    }

    const playlistContent = await response.Body.transformToString();

    // Validate that it's actually an HLS playlist
    if (!playlistContent.startsWith('#EXTM3U')) {
      throw new NotFoundException(
        `Invalid HLS playlist format for video ${videoId} variant ${resolution}. The file may not be an HLS playlist.`,
      );
    }

    // Update segment URLs in playlist to use API endpoints with authentication
    // Segment paths in playlist are relative (e.g., "segment_000.ts")
    // We need to convert them to full URLs with token
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const segmentBaseUrl = baseUrl
      ? `${baseUrl}/api/v1/watch/hls/${videoId}/variants/${resolution}`
      : `/api/v1/watch/hls/${videoId}/variants/${resolution}`;

    // Replace relative segment paths with absolute URLs
    const updatedPlaylist = playlistContent.replace(
      /(segment_\d+\.ts)/g,
      (match) => `${segmentBaseUrl}/${match}${tokenParam}`,
    );

    return updatedPlaylist;
  }

  /**
   * Get presigned URL for a video segment (.ts file) or MP4 file
   */
  async getVariantSegmentUrl(
    videoId: number,
    resolution: VideoResolution,
    segmentName?: string,
  ): Promise<string> {
    // Validate variant exists
    const variant = await this.videoVariantRepository.findOneOrNone({
      where: { video_id: videoId, resolution } as any,
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant ${resolution} not found for video ${videoId}`,
      );
    }

    // If segment name is provided, construct HLS segment S3 key
    // Otherwise, use the variant key directly (for MP4 fallback)
    const s3Key = segmentName
      ? `videos/hls/${videoId}/${resolution}/${segmentName}`
      : variant.key;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600, // 1 hour
    });

    return presignedUrl;
  }

  /**
   * Get the best quality variant for a video
   */
  async getBestQualityVariant(
    videoId: number,
  ): Promise<VideoVariant | null> {
    // Get all variants sorted by resolution (highest first)
    const variants = await this.videoVariantRepository.findAll({
      where: { video_id: videoId } as any,
      order: { resolution: 'DESC' } as any,
    });

    if (variants.length === 0) {
      return null;
    }

    // Return the highest quality variant (first in DESC sorted list)
    return variants[0];
  }

  /**
   * Get presigned URL for HLS manifest
   */
  async getHLSManifestUrl(videoId: number): Promise<string> {
    const manifestKey = `videos/hls/${videoId}/master.m3u8`;

    // For now, generate manifest on-the-fly
    // In production, you might want to store it in S3 and serve from there
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: manifestKey,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3, command, {
        expiresIn: 3600,
      });
      return presignedUrl;
    } catch (error) {
      // If manifest doesn't exist in S3, we'll generate it dynamically
      // This is handled by the controller
      throw new NotFoundException('HLS manifest not found');
    }
  }

  /**
   * Estimate bandwidth for resolution
   */
  private estimateBandwidth(resolution: VideoResolution): number {
    const bandwidths = {
      [VideoResolution.P1080]: 5000000, // 5 Mbps
      [VideoResolution.P720]: 3000000, // 3 Mbps
      [VideoResolution.P480]: 1500000, // 1.5 Mbps
      [VideoResolution.P360]: 800000, // 0.8 Mbps
    };
    return bandwidths[resolution] || 1000000;
  }

  /**
   * Get resolution string (e.g., "1920x1080")
   */
  private getResolutionString(resolution: VideoResolution): string {
    const resolutions = {
      [VideoResolution.P1080]: '1920x1080',
      [VideoResolution.P720]: '1280x720',
      [VideoResolution.P480]: '854x480',
      [VideoResolution.P360]: '640x360',
    };
    return resolutions[resolution] || '640x360';
  }
}

