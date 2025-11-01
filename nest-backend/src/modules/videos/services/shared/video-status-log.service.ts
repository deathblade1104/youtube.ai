import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VideoProcessingStatus } from '../../../../common/enums/video-status.enum';
import { VideoStatusLog } from '../../../../database/postgres/entities/video-status-log.entity';
import { Videos } from '../../entities/video.entity';
import { VideoStatusEventService } from './video-status-event.service';

/**
 * Service for logging video status changes
 */
@Injectable()
export class VideoStatusLogService {
  private readonly logger = new Logger(VideoStatusLogService.name);

  constructor(
    @InjectRepository(VideoStatusLog)
    private readonly statusLogRepo: Repository<VideoStatusLog>,
    private readonly statusEventService?: VideoStatusEventService,
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
      // Optimized: Use repository method instead of raw query builder
      const latestLogs = await this.statusLogRepo.find({
        where: { video_id: videoId } as any,
        order: { created_at: 'DESC' } as any,
        take: 1,
      });
      const latestLog = latestLogs.length > 0 ? latestLogs[0] : null;

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

      let savedLog: VideoStatusLog;
      if (transactionManager) {
        // Use transaction manager if provided (for atomic operations)
        savedLog = await transactionManager.save(VideoStatusLog, logEntry);
      } else {
        // Use repository directly
        savedLog = await this.statusLogRepo.save(logEntry);
      }

      // Emit event for real-time SSE subscribers
      if (this.statusEventService) {
        try {
          // Get current video status to include in update
          const videoRepo = transactionManager?.getRepository(Videos) ||
                          this.statusLogRepo.manager.getRepository(Videos);
          const video = await videoRepo.findOne({
            where: { id: videoId } as any,
          });

          this.statusEventService.emitFromStatusLog(
            savedLog,
            video?.status,
            video?.processed_at,
          );
        } catch (err: any) {
          // Don't fail if event emission fails
          this.logger.warn(`Failed to emit status event: ${err.message}`);
        }
      }

      return savedLog;
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
