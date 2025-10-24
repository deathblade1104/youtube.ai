import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';
config();

export interface CacheConfig {
  host: string;
  port: number;
  password: string;
  ttl: number;
}

export default registerAs(
  CONFIG.REDIS,
  (): CacheConfig => ({
    host: process.env.REDIS_HOST as string,
    port: parseInt(process.env.REDIS_PORT as string),
    password: process.env.REDIS_PASSWORD as string,
    ttl: parseInt(process.env.REDIS_TTL || '3600'),
  }),
);
