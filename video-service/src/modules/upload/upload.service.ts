import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../../common/enums/config.enums';
import { IAwsConfig } from '../../configs/aws.config';
import { GenericCrudRepository } from '../../database/postgres/repository/generic-crud.repository';
import { S3Service } from '../../providers/infra/s3/s3.service';
import {
  AbortUploadDto,
  CompleteUploadDto,
  GeneratePresignedUrlDto,
  InitializeUploadDto,
  SaveVideoDto,
} from './dtos/upload.dto';
import { Videos } from './entities/video.entity';
import { UploadKakfaProducerService } from './upload-kafka-producer.service';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(UploadService.name);
  private readonly videoRepository: GenericCrudRepository<Videos>;

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
    private readonly kafkaProducer: UploadKakfaProducerService,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
  ) {
    this.s3 = s3Service.getS3Client();
    this.bucket = this.configService.getOrThrow<IAwsConfig>(
      CONFIG.AWS,
    ).buckets.YOUTUBE;
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
  }

  async initializeMultipartUpload(dto: InitializeUploadDto) {
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

    if (!/\.(mp4|webm|mkv|mov|ogg)$/i.test(key.split(':')[1])) {
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

      await this.kafkaProducer.publishVideoUploaded(key, result.Location);

      return {
        location: result.Location,
        key,
      };
    } catch (error) {
      this.logger.error('❌ Failed to complete multipart upload', error);
      throw new InternalServerErrorException('Upload completion failed');
    }
  }

  async abortMultipartUpload(dto: AbortUploadDto) {
    const { upload_id, key } = dto;

    try {
      await this.s3.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: upload_id,
        }),
      );
      return { message: 'upload_aborted', key };
    } catch (e) {
      if (e.name === 'NoSuchUpload') {
        throw new BadRequestException(
          'Upload already completed or does not exist.',
        );
      }
      throw e;
    }
  }

  async saveVideo(dto: SaveVideoDto, userId: string): Promise<Videos> {
    //const user = await this.userGrpcClient.svc().getUserById(userId);
    return await this.videoRepository.create({
      ...dto,
      user_id: parseInt(userId),
    });
  }
}
