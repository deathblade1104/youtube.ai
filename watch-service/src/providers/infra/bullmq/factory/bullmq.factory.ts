import {
  BullRootModuleOptions,
  SharedBullConfigurationFactory,
} from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG } from '../../../../common/enums/config.enums';
import { CacheConfig } from '../../../../configs/redis.config';

@Injectable()
export class BullMQConfigService implements SharedBullConfigurationFactory {
  private cacheConfig: CacheConfig;

  constructor(private readonly configService: ConfigService) {
    this.cacheConfig = this.configService.getOrThrow<CacheConfig>(CONFIG.REDIS);
  }

  createSharedConfiguration(): BullRootModuleOptions {
    const bullMqConfig: BullRootModuleOptions = {
      connection: {
        host: this.cacheConfig.host,
        port: this.cacheConfig.port,
      },
    };

    return bullMqConfig;
  }
}
