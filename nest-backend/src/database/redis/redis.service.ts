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
  private readonly redisClient: any;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configSevice: ConfigService,
  ) {
    this.serverConfig = this.configSevice.getOrThrow<IServerConfig>(
      CONFIG.SERVER,
    );
    // Access underlying Redis client from cache manager store
    this.redisClient = (this.cache as any).store?.getClient?.() || null;
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

  /**
   * Check if a Bloom Filter exists in Redis
   * @param key The Bloom Filter key to check
   * @returns true if Bloom Filter exists, false otherwise
   */
  async bloomFilterExists(key: string): Promise<boolean> {
    this.validateKey(key);
    this.validateBloomFilterSupport();

    try {
      return new Promise((resolve, reject) => {
        // Check if key exists using EXISTS command
        this.redisClient.exists(key, (err: Error, result: any) => {
          if (err) {
            this.logger.error(
              `Failed to check Bloom Filter existence for ${key}:`,
              err.stack,
            );
            reject(err);
          } else {
            resolve(result === 1);
          }
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to check Bloom Filter existence for ${key}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to check Bloom Filter existence',
      );
    }
  }

  /**
   * Get information about a Bloom Filter (stats)
   * @param key The Bloom Filter key
   * @returns Bloom Filter information or null if doesn't exist
   */
  async getBloomFilterInfo(key: string): Promise<any> {
    this.validateKey(key);
    this.validateBloomFilterSupport();

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.INFO',
          [key],
          (err: Error, result: any) => {
            if (err) {
              if (err.message?.includes('ERR')) {
                resolve(null); // Doesn't exist
              } else {
                this.logger.error(
                  `Failed to get Bloom Filter info for ${key}:`,
                  err.stack,
                );
                reject(err);
              }
            } else {
              // Convert array to object for easier access
              const info: any = {};
              for (let i = 0; i < result.length; i += 2) {
                info[result[i]] = result[i + 1];
              }
              resolve(info);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(`Failed to get Bloom Filter info for ${key}:`, error);
      throw new InternalServerErrorException(
        'Failed to get Bloom Filter information',
      );
    }
  }

  /**
   * Create a Bloom Filter in Redis
   * @param key The key name for the Bloom Filter
   * @param capacity Expected number of elements
   * @param errorRate Error rate (default: 0.01)
   * @returns true if created, false if already exists
   */
  async createBloomFilter(
    key: string,
    capacity: number,
    errorRate: number = 0.01,
  ): Promise<boolean> {
    this.validateKey(key);
    this.validateBloomFilterSupport();

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.RESERVE',
          [key, errorRate.toString(), capacity.toString()],
          (err: Error, result: any) => {
            if (err) {
              if (err.message?.includes('ERR')) {
                resolve(false); // Already exists
              } else {
                this.logger.error(
                  `Failed to create Bloom Filter ${key}:`,
                  err.stack,
                );
                reject(err);
              }
            } else {
              this.logger.log(`Bloom Filter ${key} created successfully`);
              resolve(true);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(`Failed to create Bloom Filter ${key}:`, error);
      throw new InternalServerErrorException('Failed to create Bloom Filter');
    }
  }

  /**
   * Add a single element to Bloom Filter
   * @param key The Bloom Filter key
   * @param value The string value to add
   * @returns true if added (or might have been added before)
   */
  async addToBloomFilter(key: string, value: string): Promise<boolean> {
    this.validateKey(key);
    this.validateString(value);
    this.validateBloomFilterSupport();

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.ADD',
          [key, value],
          (err: Error, result: any) => {
            if (err) {
              this.logger.error(
                `Failed to add value to Bloom Filter ${key}:`,
                err.stack,
              );
              reject(err);
            } else {
              resolve(result === 1);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(`Failed to add value to Bloom Filter ${key}:`, error);
      throw new InternalServerErrorException('Failed to add to Bloom Filter');
    }
  }

  /**
   * Add multiple elements to Bloom Filter in bulk
   * @param key The Bloom Filter key
   * @param values Array of string values to add
   * @returns Array of booleans indicating if each value was newly added
   */
  async addToBloomFilterBulk(
    key: string,
    values: string[],
  ): Promise<boolean[]> {
    this.validateKey(key);
    this.validateBloomFilterSupport();

    if (!values || values.length === 0) {
      return [];
    }

    // Validate all values are strings
    values.forEach((value) => this.validateString(value));

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.MADD',
          [key, ...values],
          (err: Error, result: any) => {
            if (err) {
              this.logger.error(
                `Failed to add bulk values to Bloom Filter ${key}:`,
                err.stack,
              );
              reject(err);
            } else {
              resolve(result);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to add bulk values to Bloom Filter ${key}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to add bulk values to Bloom Filter',
      );
    }
  }

  /**
   * Check if an element exists in Bloom Filter
   * @param key The Bloom Filter key
   * @param value The string value to check
   * @returns true if might exist, false if definitely doesn't exist
   */
  async existsInBloomFilter(key: string, value: string): Promise<boolean> {
    this.validateKey(key);
    this.validateString(value);
    this.validateBloomFilterSupport();

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.EXISTS',
          [key, value],
          (err: Error, result: any) => {
            if (err) {
              this.logger.error(
                `Failed to check value in Bloom Filter ${key}:`,
                err.stack,
              );
              reject(err);
            } else {
              resolve(result === 1);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(`Failed to check value in Bloom Filter ${key}:`, error);
      throw new InternalServerErrorException('Failed to check Bloom Filter');
    }
  }

  /**
   * Check if multiple elements exist in Bloom Filter
   * @param key The Bloom Filter key
   * @param values Array of string values to check
   * @returns Array of booleans for each value
   */
  async existsInBloomFilterBulk(
    key: string,
    values: string[],
  ): Promise<boolean[]> {
    this.validateKey(key);
    this.validateBloomFilterSupport();

    if (!values || values.length === 0) {
      return [];
    }

    // Validate all values are strings
    values.forEach((value) => this.validateString(value));

    try {
      return new Promise((resolve, reject) => {
        // node_redis sendCommand: (command: string, args: string[], callback)
        this.redisClient.sendCommand(
          'BF.MEXISTS',
          [key, ...values],
          (err: Error, result: any) => {
            if (err) {
              this.logger.error(
                `Failed to check bulk values in Bloom Filter ${key}:`,
                err.stack,
              );
              reject(err);
            } else {
              resolve(result);
            }
          },
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to check bulk values in Bloom Filter ${key}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to check bulk values in Bloom Filter',
      );
    }
  }

  private validateBloomFilterSupport(): void {
    if (!this.redisClient) {
      throw new InternalServerErrorException(
        'Redis client not available. Bloom Filter commands require Redis with RediBloom module.',
      );
    }
  }

  private validateString(value: string): void {
    if (typeof value !== 'string') {
      throw new InternalServerErrorException(
        'Bloom Filter only supports string values',
      );
    }
  }
}
