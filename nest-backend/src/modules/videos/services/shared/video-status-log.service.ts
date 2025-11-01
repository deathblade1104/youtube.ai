import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { VideoStatusLog } from '../../../../database/postgres/entities/video-status-log.entity';

/**
 * Service for logging video status changes
 */
@Injectable()
export class VideoStatusLogService {
  private readonly logger = new Logger(VideoStatusLogService.name);

  constructor(
    @InjectRepository(VideoStatusLog)
    private readonly statusLogRepo: Repository<VideoStatusLog>,
  ) {}

  /**
   * Log a video status change
   * Only logs if the status is different from the last logged status
   * @param videoId Video ID
   * @param status New status
   * @param actor Who/what made the change ('system', 'nest-be', 'python-backend', or user ID like 'user-123')
   * @param statusMessage Optional message/context
   * @param transactionManager Optional transaction manager for atomic operations
   */
  async logStatusChange(
    videoId: number,
    status: VideoProcessingStatus,
    actor: string = 'system',
    statusMessage: string | null = null,
    transactionManager?: EntityManager,
  ): Promise<VideoStatusLog | null> {
    try {
      // Check the most recent status log for this video
      const latestLog = await this.statusLogRepo
        .createQueryBuilder('log')
        .where('log.video_id = :videoId', { videoId })
        .orderBy('log.created_at', 'DESC')
        .limit(1)
        .getOne();

      // Only log if:
      // 1. No previous status exists (first log), OR
      // 2. The new status is different from the latest status
      if (latestLog && latestLog.status === status) {
        this.logger.debug(
          `⏭️ Skipping duplicate status log: videoId=${videoId}, status=${status} (same as latest)`,
        );
        return null; // Return null to indicate no log was created
      }

      const logEntry = this.statusLogRepo.create({
        video_id: videoId,
        status,
        actor,
        status_message: statusMessage,
      });

      if (transactionManager) {
        // Use transaction manager if provided (for atomic operations)
        return await transactionManager.save(VideoStatusLog, logEntry);
      } else {
        // Use repository directly
        return await this.statusLogRepo.save(logEntry);
      }
    } catch (error: any) {
      // Don't fail the main operation if logging fails
      this.logger.warn(
        `Failed to log status change for video ${videoId}: ${error.message}`,
      );
      throw error; // Re-throw but allow caller to handle gracefully
    }
  }

  /**
   * Get status history for a video
   */
  async getStatusHistory(videoId: number): Promise<VideoStatusLog[]> {
    return await this.statusLogRepo
      .createQueryBuilder('log')
      .where('log.video_id = :videoId', { videoId })
      .orderBy('log.created_at', 'DESC')
      .getMany();
  }
}
