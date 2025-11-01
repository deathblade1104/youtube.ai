import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

/**
 * Service for publishing events to Kafka topics.
 * Provides a clean interface over the Kafka client with logging and error handling.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(
    @Inject('KAFKA_PRODUCER') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafkaClient.connect();
    this.logger.log('✅ Kafka producer connected');
  }

  /**
   * Publish an event to a Kafka topic.
   *
   * @param topic - Kafka topic name
   * @param payload - Event payload
   * @param eventId - Optional event ID for idempotency tracking
   * @returns Promise that resolves when event is published
   */
  async emit(
    topic: string,
    payload: Record<string, any>,
    eventId?: string,
  ): Promise<void> {
    try {
      const message = eventId ? { ...payload, eventId } : payload;

      await this.kafkaClient.emit(topic, message);

      this.logger.debug(
        `📤 Published event to Kafka: topic=${topic}, eventId=${eventId || 'N/A'}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to publish event to Kafka: topic=${topic}, eventId=${eventId || 'N/A'}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Publish an event and wait for response (request-response pattern).
   * Not used in current implementation, but available if needed.
   */
  async send(
    topic: string,
    payload: Record<string, any>,
    eventId?: string,
  ): Promise<any> {
    try {
      const message = eventId ? { ...payload, eventId } : payload;

      const response = await this.kafkaClient.send(topic, message).toPromise();

      this.logger.debug(
        `📤 Sent request to Kafka: topic=${topic}, eventId=${eventId || 'N/A'}`,
      );

      return response;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to send request to Kafka: topic=${topic}, eventId=${eventId || 'N/A'}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if Kafka client is connected.
   */
  isConnected(): boolean {
    return this.kafkaClient instanceof ClientKafka;
  }

  /**
   * Get the underlying Kafka client (use sparingly, prefer service methods).
   */
  getClient(): ClientKafka {
    return this.kafkaClient;
  }
}
