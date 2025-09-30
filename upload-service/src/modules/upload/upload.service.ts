import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG } from '../../common/enums/config.enums';
import { IAwsConfig } from '../../configs/aws.config';
import { S3Service } from '../../providers/infra/s3/s3.service';
import { UploadKakfaProducerService } from './upload-kafka-producer.service';

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly uploadProducer: UploadKakfaProducerService,
  ) {
    this.s3 = s3Service.getS3Client();
    this.bucket = this.configService.getOrThrow<IAwsConfig>(
      CONFIG.AWS,
    ).buckets.YOUTUBE;
  }

  async uploadBuffer(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file received');
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: file.originalname,
          Body: file.buffer,
        }),
      );

      await this.uploadProducer.publishVideoUploaded('ID', file.originalname);

      return {
        message: 'File uploaded successfully',
        key: file.originalname,
        location: `${this.bucket}/${file.originalname}`,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new InternalServerErrorException('Upload failed');
    }
  }
}
