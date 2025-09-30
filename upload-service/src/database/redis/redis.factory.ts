import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CONFIG } from '../../common/enums/config.enums';
import { CacheConfig } from '../../configs/redis.config';

@Injectable()
export class CacheConfigFactory implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions> {
    const cacheConfig = this.configService.getOrThrow<CacheConfig>(
      CONFIG.REDIS,
    );
    const redisURL = `redis://${cacheConfig.host}:${cacheConfig.port}`;
    return {
      store: redisStore,
      url: redisURL,
      ttl: cacheConfig.ttl,
    };
  }
}
