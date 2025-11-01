import { Column, Entity, Index } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

export enum UploadStatus {
  INITIALIZED = 'initialized',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABORTED = 'aborted',
}

@Entity(TableNames.UPLOAD_METADATA)
@Index(['user_id'])
@Index(['upload_id', 'key'], { unique: true })
export class UploadMetadata extends AbstractEntity<UploadMetadata> {
  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false, unique: true })
  upload_id: string;

  @Column({ nullable: false })
  key: string;

  @Column({ nullable: false })
  filename: string;

  @Column({ nullable: false, type: 'varchar', length: 50 })
  content_type: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: UploadStatus,
    default: UploadStatus.INITIALIZED,
  })
  status: UploadStatus;
}

