import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { AWSBucket } from '../common/enums/buckets.enum';
import { CONFIG } from '../common/enums/config.enums';
config();

export interface IAwsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: Record<AWSBucket, string>;
  s3Endpoint?: URL;
  useLocalstack: boolean;
}

export default registerAs(
  CONFIG.AWS,
  (): IAwsConfig => ({
    region: process.env.AWS_REGION as string,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    buckets: {
      [AWSBucket.YOUTUBE]: process.env.AWS_YOUTUBE_BUCKET as string,
    },
    s3Endpoint: process.env.AWS_S3_ENDPOINT
      ? new URL(process.env.AWS_S3_ENDPOINT)
      : undefined,
    useLocalstack: process.env.USE_LOCALSTACK === 'true',
  }),
);
