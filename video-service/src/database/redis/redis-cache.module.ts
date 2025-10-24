import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import redisConfig from 'src/configs/redis.config';
import { CacheConfigFactory } from './redis.factory';
import { CacheService } from './redis.service';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useClass: CacheConfigFactory,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, CacheModule],
})
export class RedisCacheModule {}
