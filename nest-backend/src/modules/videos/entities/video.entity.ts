import { Column, Entity, Index } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

@Entity(TableNames.VIDEOS)
@Index(['user_id'])
@Index(['status'])
export class Videos extends AbstractEntity<Videos> {
  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  user_name: string;

  @Column({ nullable: false })
  key: string;

  @Column({
    type: 'enum',
    enum: VideoProcessingStatus,
    default: VideoProcessingStatus.PENDING,
    nullable: false,
  })
  status: VideoProcessingStatus;

  @Column({ type: 'text', nullable: true, name: 'status_message' })
  status_message: string | null; // Error message or progress info

  @Column({ type: 'timestamp', nullable: true, name: 'processed_at' })
  processed_at: Date | null; // When fully processed
}
