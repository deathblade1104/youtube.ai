import {
    Column,
    Entity,
    Index,
    JoinColumn,
    OneToOne,
    UpdateDateColumn,
} from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { Videos } from '../../../modules/videos/entities/video.entity';
import { AbstractEntity } from '../abstract.entity';

export enum TranscriptStatus {
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity(TableNames.VIDEO_TRANSCRIPTS)
@Index(['video_id'], { unique: true })
export class VideoTranscript extends AbstractEntity<VideoTranscript> {
  @Column({ name: 'video_id', nullable: false })
  video_id: number;

  @OneToOne(() => Videos)
  @JoinColumn({ name: 'video_id' })
  video: Videos;

  @Column({ name: 'transcript_text', type: 'text', nullable: true })
  transcript_text: string;

  @Column({ name: 'transcript_path', type: 'text', nullable: true })
  transcript_path: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: TranscriptStatus.PROCESSING,
    enum: TranscriptStatus,
  })
  status: TranscriptStatus;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  duration_seconds: number;

  @Column({ name: 'model_info', type: 'jsonb', nullable: true })
  model_info: Record<string, any>;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
