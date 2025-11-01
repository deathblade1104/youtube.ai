import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../abstract.entity';
import { Videos } from '../../../modules/videos/entities/video.entity';
import { User } from '../../../modules/user/entities/user.entity';

@Entity(TableNames.COMMENTS)
@Index('idx_comments_video_id', ['video_id'])
@Index('idx_comments_parent_id', ['parent_id'])
@Index('idx_comments_user_id', ['user_id'])
export class Comment extends AbstractEntity<Comment> {
  @Column({ name: 'video_id', nullable: false })
  video_id: number;

  @ManyToOne(() => Videos)
  @JoinColumn({ name: 'video_id' })
  video: Videos;

  @Column({ name: 'user_id', nullable: false })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'parent_id', nullable: true })
  parent_id: number | null; // For replies, null for top-level comments

  @ManyToOne(() => Comment, (comment) => comment.replies)
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ default: 0 })
  likes: number;

  @Column({ default: false })
  is_edited: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'edited_at' })
  edited_at: Date | null;
}

