import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OutboxEvent } from '../../../../database/postgres/entities/outbox-event.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';

export interface OutboxEventPayload {
  topic: string;
  payload: Record<string, any>;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly outboxRepository: GenericCrudRepository<OutboxEvent>;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly dataSource: DataSource,
  ) {
    this.outboxRepository = new GenericCrudRepository(
      outboxRepo,
      OutboxEvent.name,
    );
  }

  /**
   * Add event to outbox in the same transaction as the main operation
   * This ensures events are persisted even if Kafka is down
   */
  async addToOutbox(
    topic: string,
    payload: Record<string, any>,
    transactionManager?: any,
  ): Promise<OutboxEvent> {
    // Use GenericCrudRepository which supports transaction manager
    return await this.outboxRepository.create(
      {
        topic,
        payload,
        published: false,
        attempts: 0,
      } as any,
      transactionManager,
    );
  }

  /**
   * Get unpublished events (for background publisher)
   */
  async getUnpublishedEvents(limit: number = 100): Promise<OutboxEvent[]> {
    return await this.outboxRepository.findAll({
      where: { published: false } as any,
      take: limit,
      order: { created_at: 'ASC' } as any,
    });
  }

  /**
   * Mark event as published
   */
  async markAsPublished(id: string, transactionManager?: any): Promise<void> {
    const event = await this.outboxRepository.findOneOrNone({
      where: { id } as any,
    });

    if (event) {
      await this.outboxRepository.updateBy(
        { where: { id } as any },
        {
          published: true,
          published_at: new Date(),
        },
        transactionManager,
      );
    }

    this.logger.debug(`✅ Marked outbox event as published: id=${id}`);
  }

  /**
   * Increment attempts counter
   */
  async incrementAttempts(id: string): Promise<void> {
    const event = await this.outboxRepository.findOneOrNone({
      where: { id } as any,
    });

    if (event) {
      await this.outboxRepository.updateBy(
        { where: { id } as any },
        {
          attempts: event.attempts + 1,
        },
      );
      this.logger.debug(
        `📊 Incremented attempts for outbox event: id=${id}, attempts=${event.attempts + 1}`,
      );
    }
  }
}

