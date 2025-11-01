import { Column, Entity, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from './abstract.entity';
import { Comment } from './comment.entity';
import { User } from '../../../modules/user/entities/user.entity';

@Entity(TableNames.COMMENT_LIKES)
@Unique(['user_id', 'comment_id']) // Enforce one like per user per comment at database level
@Index(['user_id'])
@Index(['comment_id'])
export class CommentLike extends AbstractEntity<CommentLike> {
  @Column({ name: 'user_id', nullable: false })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'comment_id', nullable: false })
  comment_id: number;

  @ManyToOne(() => Comment)
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;
}

