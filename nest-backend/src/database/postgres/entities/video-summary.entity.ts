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

@Entity(TableNames.VIDEO_SUMMARIES)
@Index(['video_id'], { unique: true })
export class VideoSummary extends AbstractEntity<VideoSummary> {
  @Column({ name: 'video_id', nullable: false })
  video_id: number;

  @OneToOne(() => Videos)
  @JoinColumn({ name: 'video_id' })
  video: Videos;

  @Column({ name: 'summary_text', type: 'text', nullable: true })
  summary_text: string;

  @Column({ name: 'summary_path', type: 'text', nullable: true })
  summary_path: string;

  @Column({ name: 'model_info', type: 'jsonb', nullable: true })
  model_info: Record<string, any>;

  @Column({ name: 'quality_score', type: 'float', nullable: true })
  quality_score: number;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
