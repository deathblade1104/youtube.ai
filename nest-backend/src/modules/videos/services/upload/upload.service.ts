import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AWSBucket } from '../../../../common/enums/buckets.enum';
import { CONFIG } from '../../../../common/enums/config.enums';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { IAwsConfig } from '../../../../configs/aws.config';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import { UserService } from '../../../user/user.service';
import { OutboxService } from '../shared/outbox.service';
import { VideoStatusLogService } from '../shared/video-status-log.service';

import { S3Service } from '../../../../providers/s3/s3.service';
import {
  AbortUploadDto,
  CompleteUploadDto,
  GeneratePresignedUrlDto,
  InitializeUploadDto,
  SaveVideoDto,
  UploadThumbnailDto,
} from '../../dtos/upload.dto';
import {
  UploadMetadata,
  UploadStatus,
} from '../../entities/upload-metadata.entity';
import { Videos } from '../../entities/video.entity';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(UploadService.name);
  private readonly videoRepository: GenericCrudRepository<Videos>;
  private readonly uploadMetadataRepository: GenericCrudRepository<UploadMetadata>;

  private readonly allowedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/mkv',
    'video/quicktime',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly statusLogService: VideoStatusLogService,
    private readonly userService: UserService,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(UploadMetadata)
    private readonly uploadMetadataRepo: Repository<UploadMetadata>,
  ) {
    this.s3 = s3Service.getS3Client();
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);
    this.bucket = awsConfig.buckets[AWSBucket.YOUTUBE];
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.uploadMetadataRepository = new GenericCrudRepository(
      uploadMetadataRepo,
      UploadMetadata.name,
    );
  }

  async initializeMultipartUpload(dto: InitializeUploadDto, userId: string) {
    const { filename, content_type } = dto;

    if (!this.allowedMimeTypes.includes(content_type)) {
      throw new BadRequestException(`Invalid content type: ${content_type}`);
    }

    if (!/\.(mp4|webm|mkv|mov|ogg)$/i.test(filename)) {
      throw new BadRequestException('Invalid file extension.');
    }

    try {
      const uniqueKey = `${uuidv4()}:${filename}`;
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: uniqueKey,
        ContentType: content_type,
      });

      const { UploadId } = await this.s3.send(command);
      this.logger.log(`✅ Multipart upload started: ${UploadId}`);

      // Store upload metadata for ownership validation
      await this.uploadMetadataRepository.create({
        user_id: parseInt(userId),
        upload_id: UploadId,
        key: uniqueKey,
        filename,
        content_type,
        status: UploadStatus.INITIALIZED,
      });

      return {
        upload_id: UploadId,
        key: uniqueKey,
        original_filename: filename,
      };
    } catch (error) {
      this.logger.error('Failed to initialize multipart upload', error);
      throw new InternalServerErrorException(
        'Failed to initialize multipart upload',
      );
    }
  }

  async generatePresignedUrlForPart(dto: GeneratePresignedUrlDto) {
    const { upload_id, key, part_number } = dto;

    try {
      // Update status to IN_PROGRESS when first part is requested
      const uploadMetadata = await this.uploadMetadataRepository.findOneBy({
        where: { upload_id, key },
      });

      if (
        uploadMetadata &&
        uploadMetadata.status === UploadStatus.INITIALIZED
      ) {
        await this.updateUploadStatus(upload_id, UploadStatus.IN_PROGRESS);
      }

      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: upload_id,
        PartNumber: part_number,
      });

      const presignedUrl = await getSignedUrl(this.s3, command, {
        expiresIn: 3600,
      });

      return {
        presigned_url: presignedUrl,
        part_number,
      };
    } catch (error) {
      this.logger.error('❌ Failed to generate presigned URL', error);
      throw new InternalServerErrorException(
        'Failed to generate presigned URL',
      );
    }
  }

  async completeMultipartUpload(dto: CompleteUploadDto, userId: string) {
    const { key, upload_id, parts } = dto;

    // Validate ownership
    await this.validateUploadOwnership(upload_id, key, userId);

    // Validate key format
    const filename = key.split(':')[1];
    if (!filename || !/\.(mp4|webm|mkv|mov|ogg)$/i.test(filename)) {
      throw new BadRequestException('Invalid video key.');
    }

    try {
      const completeCmd = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: upload_id,
        MultipartUpload: { Parts: parts },
      });

      const result = await this.s3.send(completeCmd);
      this.logger.log(`✅ Multipart upload completed: ${result.Location}`);

      // Update upload metadata status
      await this.updateUploadStatus(upload_id, UploadStatus.COMPLETED);

      // Get upload metadata for event
      const uploadMetadata = await this.uploadMetadataRepository.findOneBy({
        where: { upload_id, key },
      });

      // Note: video.uploaded event will be published after saveVideo() is called
      // when we have the database videoId

      return {
        location: result.Location,
        key,
      };
    } catch (error) {
      this.logger.error('❌ Failed to complete multipart upload', error);
      throw new InternalServerErrorException('Upload completion failed');
    }
  }

  async abortMultipartUpload(dto: AbortUploadDto, userId: string) {
    const { upload_id, key } = dto;

    // Validate ownership
    await this.validateUploadOwnership(upload_id, key, userId);

    try {
      await this.s3.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: upload_id,
        }),
      );

      // Update upload metadata status
      await this.updateUploadStatus(upload_id, UploadStatus.ABORTED);

      return { message: 'upload_aborted', key };
    } catch (e: any) {
      // AWS SDK v3 error handling - check both name and Code properties
      if (
        e?.name === 'NoSuchUpload' ||
        e?.Code === 'NoSuchUpload' ||
        e?.code === 'NoSuchUpload'
      ) {
        throw new BadRequestException(
          'Upload already completed or does not exist.',
        );
      }
      this.logger.error(`Failed to abort multipart upload: ${e?.message || e}`);
      throw new InternalServerErrorException('Failed to abort upload');
    }
  }

  async saveVideo(dto: SaveVideoDto, userId: string): Promise<Videos> {
    // Fetch user info to get user_name
    const userInfo = await this.userService.getUserInfoById(parseInt(userId));

    // Get upload metadata for event
    const uploadMetadata = await this.uploadMetadataRepository.findOneBy({
      where: { key: dto.key },
    });

    // Use transaction to ensure video and outbox event are written atomically
    return await this.dataSource.transaction(async (transactionManager) => {
      // Create video in transaction with initial PENDING status
      const video = await transactionManager.save(
        transactionManager.create(Videos, {
          ...dto,
          user_id: parseInt(userId),
          user_name: userInfo.name,
          status: VideoProcessingStatus.PENDING,
        }),
      );

      // Log initial PENDING status in transaction
      await this.statusLogService
        .logStatusChange(
          video.id,
          VideoProcessingStatus.PENDING,
          `user-${userId}`,
          'Video uploaded and ready for processing',
          transactionManager,
        )
        .catch((err) =>
          this.logger.warn(`Failed to log status: ${err.message}`),
        );

      // Write event to outbox in the same transaction
      if (uploadMetadata) {
        const payload = {
          id: uuidv4(),
          videoId: video.id,
          userId: parseInt(userId),
          fileKey: dto.key,
          metadata: {
            filename: uploadMetadata.filename,
            contentType: uploadMetadata.content_type,
            uploadId: uploadMetadata.upload_id,
          },
          correlationId: uuidv4(),
          messageId: uuidv4(),
          ts: new Date().toISOString(),
        };

        await this.outboxService.addToOutbox(
          'video.uploaded',
          payload,
          transactionManager,
        );

        this.logger.log(
          `📝 Saved video and outbox event in transaction: videoId=${video.id}`,
        );
      }

      return video;
    });
  }

  /**
   * Validate that the user owns the upload
   */
  private async validateUploadOwnership(
    upload_id: string,
    key: string,
    userId: string,
  ): Promise<void> {
    const uploadMetadata = await this.uploadMetadataRepository.findOneBy({
      where: { upload_id, key },
    });

    if (!uploadMetadata) {
      throw new BadRequestException(
        'Upload not found or already completed/aborted.',
      );
    }

    if (uploadMetadata.user_id !== parseInt(userId)) {
      throw new UnauthorizedException(
        'You do not have permission to access this upload.',
      );
    }

    if (
      uploadMetadata.status === UploadStatus.COMPLETED ||
      uploadMetadata.status === UploadStatus.ABORTED
    ) {
      throw new BadRequestException(
        `Upload has already been ${uploadMetadata.status}.`,
      );
    }
  }

  /**
   * Update upload status in metadata
   */
  private async updateUploadStatus(
    upload_id: string,
    status: UploadStatus,
  ): Promise<void> {
    try {
      // Update directly by upload_id (more efficient than query then update)
      await this.uploadMetadataRepository.updateBy(
        { where: { upload_id } as any },
        { status },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to update upload status for ${upload_id}:`,
        error,
      );
      // Don't throw - metadata update is best-effort
    }
  }

  /**
   * Upload custom thumbnail for a video
   */
  async uploadThumbnail(
    dto: UploadThumbnailDto,
    userId: string,
  ): Promise<{
    upload_id: string;
    key: string;
    presigned_url: string;
  }> {
    const { filename, content_type, video_id } = dto;

    // Validate content type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedImageTypes.includes(content_type)) {
      throw new BadRequestException(
        `Invalid content type: ${content_type}. Allowed: ${allowedImageTypes.join(', ')}`,
      );
    }

    // Verify video exists and user owns it
    const video = await this.videoRepository.findOneOrNone({
      where: { id: video_id } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${video_id} not found`);
    }

    if (video.user_id !== parseInt(userId)) {
      throw new UnauthorizedException(
        'You do not have permission to upload thumbnail for this video',
      );
    }

    // Generate unique key for thumbnail
    const thumbnailKey = `videos/thumbnails/${video_id}_${uuidv4()}_${filename}`;

    // Create multipart upload for thumbnail (though typically thumbnails are small enough for single upload)
    // For simplicity, we'll use a single presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: thumbnailKey,
      ContentType: content_type,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600, // 1 hour
    });

    return {
      upload_id: 'thumbnail-upload', // Placeholder, not needed for single PUT
      key: thumbnailKey,
      presigned_url: presignedUrl,
    };
  }
}
