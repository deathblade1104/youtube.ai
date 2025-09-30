import { CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';
import { IBaseEntity } from './interfaces/base-entity.interface';

export class AbstractEntity<T> implements IBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  constructor(entity: Partial<T>) {
    Object.assign(this, entity);
  }
}
