import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { IBaseEntity } from '../interfaces/base-entity.interface';

@Entity(TableNames.OUTBOX_EVENTS)
@Index(['published'])
@Index(['topic'])
@Index(['service'])
export class OutboxEvent implements IBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: false })
  topic: string;

  @Column({ type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @Column({ default: false })
  published: boolean;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  service: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    nullable: true,
  })
  published_at: Date | null;
}
