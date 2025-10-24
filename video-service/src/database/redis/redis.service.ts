import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { CONFIG } from '../../common/enums/config.enums';
import { IServerConfig } from '../../configs/server.config';

@Injectable()
export class CacheService {
  private readonly serverConfig: IServerConfig;
  private readonly logger = new Logger(CacheService.name);
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configSevice: ConfigService,
  ) {
    this.serverConfig = this.configSevice.getOrThrow<IServerConfig>(
      CONFIG.SERVER,
    );
  }

  private validateKey(key: string): void {
    if (!key || key === '') {
      throw new InternalServerErrorException(
        `Redis should not be called with an empty or undefined/null key`,
      );
    }
  }

  async getValue<T>(key: string): Promise<T | null | undefined> {
    this.validateKey(key);
    const res = await this.cache.get(key);
    return res as T;
  }

  async setValue<T>(
    key: string,
    value: T,
    ttlInMilliseconds?: number,
  ): Promise<void> {
    this.validateKey(key);
    await this.cache.set(key, value, ttlInMilliseconds);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);
    await this.cache.del(key);
  }

  getCacheKey(
    module: string,
    resource: string,
    identifier: string,
    ...additionalParts: string[]
  ): string {
    return `${this.serverConfig.serviceName}:${this.serverConfig.env}:${module}:${resource}:${identifier}${additionalParts.length ? `:${additionalParts.join(':')}` : ''}`;
  }
}
