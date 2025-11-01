import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PaginationQueryDto } from '../../../../common/dtos/pagination.dto';
import { CommentLike } from '../../../../database/postgres/entities/comment-like.entity';
import { Comment } from '../../../../database/postgres/entities/comment.entity';
import { GenericCrudRepository } from '../../../../database/postgres/repository/generic-crud.repository';
import { CreateCommentDto, UpdateCommentDto } from '../../dtos/comment.dto';
import { Videos } from '../../entities/video.entity';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  private readonly commentRepository: GenericCrudRepository<Comment>;
  private readonly videoRepository: GenericCrudRepository<Videos>;

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepo: Repository<CommentLike>,
    private readonly dataSource: DataSource,
  ) {
    this.commentRepository = new GenericCrudRepository(
      commentRepo,
      Comment.name,
    );
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
  }

  /**
   * Get comments for a video with pagination
   * @param videoId - Video ID
   * @param pagination - Pagination parameters
   * @param userId - Optional user ID to check if user has liked each comment
   */
  async getComments(
    videoId: number,
    pagination: PaginationQueryDto,
    userId?: number,
  ) {
    // Verify video exists
    const video = await this.videoRepository.findOneOrNone({
      where: { id: videoId } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Get top-level comments (no parent) with user relation loaded
    const result = await this.commentRepository.findAllAndCount({
      where: { video_id: videoId, parent_id: null } as any,
      relations: ['user'], // Eager load user relation
      take: limit,
      skip,
      order: { created_at: 'DESC' } as any,
    });

    // Optimize: Fetch all replies in one query instead of N+1 queries
    const topLevelCommentIds = result.items.map((c) => c.id);
    const allReplies = await this.commentRepository.findAll({
      where: { parent_id: In(topLevelCommentIds) } as any,
      relations: ['user'], // Eager load user relation for replies
      order: { created_at: 'ASC' } as any,
    });

    // Group replies by parent_id for efficient lookup
    const repliesByParent = new Map<number, typeof allReplies>();
    for (const reply of allReplies) {
      const parentId = reply.parent_id;
      if (!repliesByParent.has(parentId)) {
        repliesByParent.set(parentId, []);
      }
      repliesByParent.get(parentId)!.push(reply);
    }

    const commentIds = [
      ...result.items.map((c) => c.id),
      ...allReplies.map((c) => c.id),
    ];

    // Check which comments the user has liked (if userId provided)
    let userLikedCommentIds = new Set<number>();
    if (userId && commentIds.length > 0) {
      // Use TypeORM In() for array condition
      const likes = await this.commentLikeRepo.find({
        where: {
          user_id: userId,
          comment_id: In(commentIds),
        },
      });
      userLikedCommentIds = new Set(likes.map((like) => like.comment_id));
    }

    // Map comments with their replies (already fetched, no additional queries)
    const commentsWithReplies = result.items.map((comment) => {
      const replies = repliesByParent.get(comment.id) || [];

      return {
        ...comment,
        user_name: comment.user?.name || null,
        replies: replies.map((reply) => ({
          ...reply,
          user_name: reply.user?.name || null,
          has_liked: userLikedCommentIds.has(reply.id),
        })),
        has_liked: userLikedCommentIds.has(comment.id),
      };
    });

    return {
      message: 'Comments retrieved successfully',
      data: {
        items: commentsWithReplies,
        total: result.total,
        page,
        limit,
      },
    };
  }

  /**
   * Create a comment or reply
   */
  async createComment(videoId: number, userId: number, dto: CreateCommentDto) {
    // Verify video exists
    const video = await this.videoRepository.findOneOrNone({
      where: { id: videoId } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    // If parent_id is provided, verify parent comment exists and belongs to same video
    if (dto.parent_id) {
      const parentComment = await this.commentRepository.findOneOrNone({
        where: { id: dto.parent_id } as any,
      });

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment ${dto.parent_id} not found`,
        );
      }

      if (parentComment.video_id !== videoId) {
        throw new BadRequestException(
          'Parent comment does not belong to this video',
        );
      }
    }

    const comment = await this.commentRepository.create({
      video_id: videoId,
      user_id: userId,
      parent_id: dto.parent_id || null,
      content: dto.content,
      likes: 0,
      is_edited: false,
      edited_at: null,
    });

    // Fetch the comment again with user relation loaded to fix "Unknown User" issue
    const commentWithUser = await this.commentRepository.findOneOrNone({
      where: { id: comment.id } as any,
      relations: ['user'],
    });

    // Map to include user_name and has_liked
    const mappedComment = commentWithUser
      ? {
          ...commentWithUser,
          user_name: commentWithUser.user?.name || null,
          has_liked: false, // New comments haven't been liked yet
        }
      : {
          ...comment,
          user_name: null,
          has_liked: false,
        };

    return {
      message: dto.parent_id
        ? 'Reply created successfully'
        : 'Comment created successfully',
      data: mappedComment,
    };
  }

  /**
   * Update a comment
   */
  async updateComment(
    videoId: number,
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentRepository.findOneOrNone({
      where: { id: commentId } as any,
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    if (comment.video_id !== videoId) {
      throw new BadRequestException('Comment does not belong to this video');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    await this.commentRepository.updateBy(
      { where: { id: commentId } as any },
      {
        content: dto.content,
        is_edited: true,
        edited_at: new Date(),
      },
    );

    // Fetch updated comment with user relation
    const updatedComment = await this.commentRepository.findOneOrNone({
      where: { id: commentId } as any,
      relations: ['user'],
    });

    return {
      message: 'Comment updated successfully',
      data: updatedComment,
    };
  }

  /**
   * Toggle like on a comment (like/unlike)
   * Uses database transaction to handle race conditions
   * Unique constraint on (user_id, comment_id) prevents duplicate likes
   */
  async toggleLikeComment(videoId: number, commentId: number, userId: number) {
    // Verify comment exists and belongs to video
    const comment = await this.commentRepository.findOneOrNone({
      where: { id: commentId } as any,
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    if (comment.video_id !== videoId) {
      throw new BadRequestException('Comment does not belong to this video');
    }

    // Use transaction to handle race conditions atomically
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        // Check if user has already liked this comment
        const existingLike = await transactionalEntityManager.findOne(
          CommentLike,
          {
            where: { user_id: userId, comment_id: commentId } as any,
          },
        );

        let newLikesCount: number;
        let hasLiked: boolean;

        if (existingLike) {
          // User already liked - unlike (remove like)
          await transactionalEntityManager.delete(CommentLike, {
            user_id: userId,
            comment_id: commentId,
          });

          // Atomic decrement using raw query to avoid race conditions
          await transactionalEntityManager
            .createQueryBuilder()
            .update(Comment)
            .set({ likes: () => 'likes - 1' })
            .where('id = :commentId', { commentId })
            .andWhere('likes > 0') // Prevent negative likes
            .execute();

          // Fetch updated count
          const updatedComment = await transactionalEntityManager.findOne(
            Comment,
            {
              where: { id: commentId } as any,
            },
          );
          newLikesCount = updatedComment?.likes ?? comment.likes - 1;
          hasLiked = false;

          this.logger.log(`User ${userId} unliked comment ${commentId}`);
        } else {
          // User hasn't liked - add like
          // Unique constraint will prevent duplicates even in race conditions
          try {
            await transactionalEntityManager.save(CommentLike, {
              user_id: userId,
              comment_id: commentId,
            });

            // Atomic increment using raw query to avoid race conditions
            await transactionalEntityManager
              .createQueryBuilder()
              .update(Comment)
              .set({ likes: () => 'likes + 1' })
              .where('id = :commentId', { commentId })
              .execute();

            // Fetch updated count
            const updatedComment = await transactionalEntityManager.findOne(
              Comment,
              {
                where: { id: commentId } as any,
              },
            );
            newLikesCount = updatedComment?.likes ?? comment.likes + 1;
            hasLiked = true;

            this.logger.log(`User ${userId} liked comment ${commentId}`);
          } catch (error: any) {
            // Handle unique constraint violation (race condition - another request already liked)
            if (error.code === '23505') {
              // PostgreSQL unique constraint violation
              this.logger.warn(
                `Race condition detected: User ${userId} tried to like comment ${commentId} but like already exists`,
              );
              // Return that user has liked it
              const updatedComment = await transactionalEntityManager.findOne(
                Comment,
                {
                  where: { id: commentId } as any,
                },
              );
              newLikesCount = updatedComment?.likes ?? comment.likes;
              hasLiked = true;
            } else {
              throw error;
            }
          }
        }

        return {
          message: hasLiked
            ? 'Comment liked successfully'
            : 'Comment unliked successfully',
          data: {
            comment_id: commentId,
            likes: newLikesCount,
            has_liked: hasLiked,
          },
        };
      },
    );
  }

  /**
   * Delete a comment
   */
  async deleteComment(videoId: number, commentId: number, userId: number) {
    const comment = await this.commentRepository.findOneOrNone({
      where: { id: commentId } as any,
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    if (comment.video_id !== videoId) {
      throw new BadRequestException('Comment does not belong to this video');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Use transaction to ensure atomic deletion
    return await this.dataSource.transaction(
      async (transactionalEntityManager) => {
        // Get all replies first
        const replies = await this.commentRepository.findAll({
          where: { parent_id: commentId } as any,
        });

        const replyIds = replies.map((reply) => reply.id);
        const allCommentIds = [commentId, ...replyIds];

        // Delete all comment_likes for the comment and its replies
        if (allCommentIds.length > 0) {
          await transactionalEntityManager.delete(CommentLike, {
            comment_id: In(allCommentIds) as any,
          });
        }

        // Delete replies first if any
        for (const reply of replies) {
          await transactionalEntityManager.delete(Comment, { id: reply.id });
        }

        // Delete the comment
        await transactionalEntityManager.delete(Comment, { id: commentId });

        return {
          message: 'Comment deleted successfully',
        };
      },
    );
  }
}
