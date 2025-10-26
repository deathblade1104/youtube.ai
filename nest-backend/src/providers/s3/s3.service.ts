import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG } from '../../common/enums/config.enums';
import { IAwsConfig } from '../../configs/aws.config';

@Injectable()
export class S3Service implements OnModuleInit {
  s3Client: S3Client;
  private buckets: string[];
  private logger = new Logger(S3Service.name);
  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.getOrThrow<IAwsConfig>(CONFIG.AWS);

    this.s3Client = new S3Client({
      region: awsConfig.region,
      endpoint: awsConfig.useLocalstack
        ? awsConfig.s3Endpoint?.toString()
        : undefined,
      forcePathStyle: awsConfig.useLocalstack,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      },
    });

    this.buckets = Object.values(awsConfig.buckets) || [];
  }

  async onModuleInit() {
    await Promise.all(this.buckets.map((name) => this.ensureBucket(name)));
  }

  private async ensureBucket(bucketName: string): Promise<void> {
    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      this.logger.log(`✅ Bucket "${bucketName}" created or already exists`);
    } catch (err: any) {
      if (
        err?.Code === 'BucketAlreadyOwnedByYou' ||
        err?.name === 'BucketAlreadyOwnedByYou'
      ) {
        this.logger.log(`✅ Bucket "${bucketName}" already exists`);
      } else if (err?.Code === 'BucketAlreadyExists') {
        this.logger.log(`⚠️  Bucket "${bucketName}" exists globally`);
      } else {
        this.logger.error(`❌ Failed to ensure bucket "${bucketName}":`, err);
      }
    }
  }

  getS3Client() {
    return this.s3Client;
  }
}
