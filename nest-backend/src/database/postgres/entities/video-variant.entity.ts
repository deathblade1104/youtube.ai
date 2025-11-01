import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../abstract.entity';
import { Videos } from '../../../modules/videos/entities/video.entity';

export enum VideoResolution {
  P1080 = '1080p',
  P720 = '720p',
  P480 = '480p',
  P360 = '360p',
}

@Entity(TableNames.VIDEO_VARIANTS)
@Index(['video_id'])
export class VideoVariant extends AbstractEntity<VideoVariant> {
  @Column({ name: 'video_id', nullable: false })
  video_id: number;

  @ManyToOne(() => Videos)
  @JoinColumn({ name: 'video_id' })
  video: Videos;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: false,
    enum: VideoResolution,
  })
  resolution: VideoResolution;

  @Column({ type: 'text', nullable: false })
  key: string;

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ type: 'text', nullable: true })
  bitrate: string;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  size_bytes: number;
}
