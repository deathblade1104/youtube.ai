import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { CacheService } from '../../../database/redis/redis.service';
import { GenericWorkerHost } from '../../../providers/bullmq/generic/genericWorkerHost';
import { BloomFilterStateService } from '../bloom-filter-state.service';
import { User } from '../entities/user.entity';
import {
  SYNC_USER_EMAILS_BATCH_SIZE,
  SYNC_USER_EMAILS_JOB_QUEUE,
  USER_EMAIL_BLOOM_FILTER_CAPACITY,
  USER_EMAIL_BLOOM_FILTER_ERROR_RATE,
  USER_EMAIL_BLOOM_FILTER_KEY,
} from '../user.constants';

export interface ISyncUserEmailsData {
  batchSize?: number;
}

@Processor(SYNC_USER_EMAILS_JOB_QUEUE)
@Injectable()
export class SyncUserEmailsProcessor extends GenericWorkerHost<null, void> {
  private readonly userRepository: GenericCrudRepository<User>;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly bloomFilterState: BloomFilterStateService,
  ) {
    super(SYNC_USER_EMAILS_JOB_QUEUE, SyncUserEmailsProcessor.name);
    this.userRepository = new GenericCrudRepository(userRepo, User.name);
  }

  // Implement the abstract method
  protected async processJob(_: Job<null>): Promise<void> {
    // Check if Bloom Filter exists, create if not
    const bloomFilterExists = await this.cacheService.bloomFilterExists(
      USER_EMAIL_BLOOM_FILTER_KEY,
    );

    if (!bloomFilterExists) {
      this.logger.log('Creating Bloom Filter for user emails...');
      await this.cacheService.createBloomFilter(
        USER_EMAIL_BLOOM_FILTER_KEY,
        USER_EMAIL_BLOOM_FILTER_CAPACITY,
        USER_EMAIL_BLOOM_FILTER_ERROR_RATE,
      );
    }

    // Fetch active users in chunks and add their emails to Bloom Filter
    let offset = 0;
    let hasMoreData = true;

    while (hasMoreData) {
      const users = await this.fetchActiveUserEmails(
        offset,
        SYNC_USER_EMAILS_BATCH_SIZE,
      );

      if (users.length === 0) {
        hasMoreData = false;
        break;
      }

      // Extract emails
      const emails = users.map((user) => user.email);

      // Add emails to Bloom Filter in bulk
      this.logger.log(`Adding ${emails.length} emails to Bloom Filter`);
      await this.cacheService.addToBloomFilterBulk(
        USER_EMAIL_BLOOM_FILTER_KEY,
        emails,
      );

      this.logger.log(
        `✅ Processed ${offset + emails.length} user emails into Bloom Filter`,
      );

      offset += SYNC_USER_EMAILS_BATCH_SIZE;

      // If we got fewer results than batch size, we're done
      if (users.length < SYNC_USER_EMAILS_BATCH_SIZE) {
        hasMoreData = false;
      }
    }

    this.logger.log('✅ User emails sync completed');

    // Mark Bloom Filter as initialized AFTER all emails are synced
    this.bloomFilterState.markAsInitialized();
    this.logger.log('✅ Bloom Filter marked as ready for use');
  }

  /**
   * Fetch only emails of active users in chunks
   */
  private async fetchActiveUserEmails(
    offset: number,
    limit: number,
  ): Promise<Pick<User, 'email'>[]> {
    // Use 'user' as alias (singular entity name convention)
    const queryBuilder: SelectQueryBuilder<User> =
      this.userRepository.createQueryBuilder('user');

    return await queryBuilder
      .select('user.email')
      .where('user.is_active = :isActive', { isActive: true })
      .skip(offset)
      .take(limit)
      .getMany();
  }
}
