import { Column, Entity, Index } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { AbstractEntity } from '../abstract.entity';

/**
 * Video Status Log Entity
 * Tracks all status changes for videos, capturing who/what made the change
 */
@Entity(TableNames.VIDEO_STATUS_LOGS)
@Index(['video_id'])
@Index(['created_at'])
export class VideoStatusLog extends AbstractEntity<VideoStatusLog> {
  @Column({ nullable: false, name: 'video_id' })
  video_id: number;

  @Column({
    type: 'enum',
    enum: VideoProcessingStatus,
    nullable: false,
  })
  status: VideoProcessingStatus;

  @Column({ type: 'text', nullable: false, default: 'system' })
  actor: string; // 'system' or user ID or service name (e.g., 'nest-be', 'python-backend', 'user-123')

  @Column({ type: 'text', nullable: true })
  status_message: string | null; // Optional message/context for the status change
}
