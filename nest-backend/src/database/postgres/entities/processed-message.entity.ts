import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { IBaseEntity } from '../interfaces/base-entity.interface';

@Entity(TableNames.PROCESSED_MESSAGES)
@Index(['topic'])
export class ProcessedMessage implements IBaseEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text', nullable: false })
  topic: string;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({
    name: 'processed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  processed_at: Date;
}
