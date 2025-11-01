import { Injectable } from '@nestjs/common';

/**
 * In-memory state manager for Bloom Filter initialization status
 * Shared across UserService and SyncUserEmailsProcessor to avoid Redis calls
 *
 * Singleton pattern: NestJS creates a single instance shared across
 * all consumers (UserService, SyncUserEmailsProcessor, etc.)
 * This ensures consistent state across the application
 */
@Injectable()
export class BloomFilterStateService {
  private isInitialized: boolean = false;

  /**
   * Mark Bloom Filter as initialized
   */
  markAsInitialized() {
    this.isInitialized = true;
  }

  /**
   * Check if Bloom Filter is initialized (in-memory, no Redis call)
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
