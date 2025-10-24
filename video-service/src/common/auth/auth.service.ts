import { Injectable } from '@nestjs/common';
import { CacheService } from '../../database/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(private readonly cacheService: CacheService) {}
  private getBlacklistedCacheKeyByToken(token: string) {
    const cacheKey = this.cacheService.getCacheKey('auth', 'blacklist', token);
    return cacheKey;
  }
  async isBlacklisted(token: string): Promise<boolean> {
    const cacheKey = this.getBlacklistedCacheKeyByToken(token);
    return !!(await this.cacheService.getValue(cacheKey));
  }
}
