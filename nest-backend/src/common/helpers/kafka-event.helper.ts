import { Logger } from '@nestjs/common';
import { GenericCrudRepository } from '../../database/postgres/repository/generic-crud.repository';
import { ProcessedMessage } from '../../database/postgres/entities/processed-message.entity';

/**
 * Common helper for handling Kafka events with idempotency checking
 */
export class KafkaEventHelper {
  /**
   * Check if event has already been processed and mark as processed if not
   * @returns true if already processed (should skip), false if new (proceed)
   */
  static async checkAndMarkAsProcessed(
    processedMessageRepository: GenericCrudRepository<ProcessedMessage>,
    eventId: string,
    topic: string,
    logger: Logger,
  ): Promise<boolean> {
    // Check idempotency: skip if already processed
    const alreadyProcessed =
      await processedMessageRepository.findOneOrNone({
        where: { id: eventId } as any,
      });

    if (alreadyProcessed) {
      logger.warn(`⏭️ Skipping duplicate message: eventId=${eventId}, topic=${topic}`);
      return true; // Already processed, skip
    }

    // Mark as processed (best-effort, handles race conditions)
    try {
      await processedMessageRepository.create({
        id: eventId,
        topic,
      } as any);
      logger.debug(`✅ Marked event as processed: eventId=${eventId}, topic=${topic}`);
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505' || error.statusCode === 409) {
        logger.debug(
          `⏭️ Event already marked as processed (race condition): eventId=${eventId}`,
        );
        return true; // Already processed by another instance
      }
      // Log error but don't fail - task will handle idempotency via DB constraints
      logger.warn(
        `⚠️ Failed to mark event as processed (non-critical): eventId=${eventId}, error=${error.message}`,
      );
    }

    return false; // Not processed, proceed
  }

  /**
   * Extract event ID from Kafka message payload
   */
  static extractEventId(message: { eventId?: string; id?: string }): string | null {
    return message.eventId || message.id || null;
  }
}

