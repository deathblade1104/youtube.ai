import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenericCrudRepository } from '../../database/postgres/repository/generic-crud.repository';
import { CacheService } from '../../database/redis/redis.service';
import { BloomFilterStateService } from './bloom-filter-state.service';
import { User } from './entities/user.entity';
import { UserInfoResponseDto } from './user-response.dto';
import { USER_EMAIL_BLOOM_FILTER_KEY } from './user.constants';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly userRepository: GenericCrudRepository<User>;
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly bloomFilterState: BloomFilterStateService,
  ) {
    this.userRepository = new GenericCrudRepository(userRepo, User.name);
  }

  async onModuleInit() {
    // Check if Bloom Filter exists on startup (one-time Redis call)
    // If Redis is not ready or authentication fails, it's OK - will be synced later
    try {
      const exists = await this.cacheService.bloomFilterExists(
        USER_EMAIL_BLOOM_FILTER_KEY,
      );
      if (exists) {
        this.bloomFilterState.markAsInitialized();
      }
    } catch (error) {
      // Redis might not be ready yet or authentication pending
      // The sync job will create the Bloom Filter and mark it ready
      console.log(
        '⚠️ Bloom Filter check skipped on startup (Redis may not be ready). Will be initialized by sync job.',
      );
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOneOrNone({
      where: { email, is_active: true },
    });
  }

  async createUser(payload: Partial<User>): Promise<User> {
    const user = await this.userRepository.create(payload);

    // Add email to Bloom Filter (fire-and-forget, non-blocking)
    // Database is the source of truth - cache failure doesn't affect user creation
    // Failed cache updates will be fixed by the daily midnight sync job
    this.addEmailToBloomFilter(user.email).catch((err) => {
      this.logger.error(
        `⚠️ Failed to update Bloom Filter for new user (id: ${user.id}, email: ${user.email})`,
        err,
      );
    });

    return user;
  }

  async getUserInfoById(userId: number): Promise<UserInfoResponseDto> {
    const user = await this.userRepository.findOneBy({
      where: { id: userId },
    });
    const { created_at: createdAt, password_hash, ...rest } = user;
    return {
      ...rest,
      created_at: createdAt.toISOString(),
    };
  }

  async checkUserEmailExists(email: string): Promise<boolean> {
    // Use in-memory cache (no Redis call)
    if (!this.bloomFilterState.isReady()) {
      // Bloom Filter doesn't exist yet, fallback to database
      this.logger.debug(
        `🔍 Checking email "${email}" via DB (Bloom Filter not ready)`,
      );
      const user = await this.getUserByEmail(email);
      const exists = user !== null;
      this.logger.log(
        `📊 Email check result: ${exists ? 'EXISTS' : 'NOT EXISTS'} [Source: DB - Bloom Filter not ready]`,
      );
      return exists;
    }

    // Check Bloom Filter first (fast probabilistic check)
    this.logger.debug(`🔍 Checking email "${email}" in Bloom Filter`);
    const mightExist = await this.cacheService.existsInBloomFilter(
      USER_EMAIL_BLOOM_FILTER_KEY,
      email,
    );

    if (!mightExist) {
      // Bloom Filter says definitely not in set
      this.logger.log(
        `📊 Email check result: NOT EXISTS [Source: Bloom Filter - True Negative]`,
      );
      return false;
    }

    // Might exist, verify with database (definitive check)
    this.logger.debug(
      `🔍 Email "${email}" might exist (Bloom Filter), verifying with DB...`,
    );
    const user = await this.getUserByEmail(email);
    if (user == null) {
      this.logger.log(
        `📊 Email check result: NOT EXISTS [Source: DB - False Positive from Bloom Filter]`,
      );
      return false;
    }

    // Found in database - add to Bloom Filter if missing (fire and forget)
    this.logger.log(
      `📊 Email check result: EXISTS [Source: DB - Verified after Bloom Filter match]`,
    );
    this.addEmailToBloomFilter(email).catch(() => {
      // Silently fail - best effort
    });

    return true;
  }

  /**
   * Add a single email to the Bloom Filter (for new user registrations)
   * @param email The email to add
   */
  async addEmailToBloomFilter(email: string): Promise<void> {
    // Use in-memory cache (no Redis call)
    if (!this.bloomFilterState.isReady()) {
      this.logger.debug(
        `⚠️ Cannot add email "${email}" to Bloom Filter - not ready`,
      );
      return;
    }

    try {
      await this.cacheService.addToBloomFilter(
        USER_EMAIL_BLOOM_FILTER_KEY,
        email,
      );
      this.logger.debug(`✅ Added email "${email}" to Bloom Filter`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to add email "${email}" to Bloom Filter:`,
        error,
      );
      // Don't throw - Bloom Filter update is best-effort
    }
  }
}
