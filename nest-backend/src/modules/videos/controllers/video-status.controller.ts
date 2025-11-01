import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { In, Repository } from 'typeorm';
import { CONFIG } from '../../../common/enums/config.enums';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import { IAuthConfig } from '../../../configs/auth.config';
import { VideoStatusLog } from '../../../database/postgres/entities/video-status-log.entity';
import { AuthService } from '../../auth/auth.service';
import { Videos } from '../entities/video.entity';
import { VideoStatusLogService } from '../services/shared/video-status-log.service';

/**
 * Controller for video status streaming and management
 */
@Controller({ path: 'videos', version: '1' })
@ApiTags('Video Status Controller')
export class VideoStatusController {
  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoStatusLog)
    private readonly statusLogRepo: Repository<VideoStatusLog>,
    private readonly statusLogService: VideoStatusLogService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * SSE endpoint to stream video status changes in real-time
   * Note: EventSource doesn't support custom headers, so token is passed as query param
   * This endpoint doesn't use JwtAuthGuard due to SSE limitations
   */
  @Get('status/:id/stream')
  @ApiOperation({
    summary: 'Stream video status changes via Server-Sent Events',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'JWT token for authentication',
  })
  async streamVideoStatus(
    @Param('id', ParseIntPipe) videoId: number,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    // Verify video exists and user owns it
    const video = await this.videoRepo.findOne({
      where: { id: videoId } as any,
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    // Verify JWT token (SSE can't use guards, so we verify manually)
    if (!token) {
      res.status(401).json({ message: 'Token required' });
      return;
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.authService.isBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ message: 'Token is blacklisted' });
      return;
    }

    // Verify and decode token using the same config as JWT strategy
    let decodedToken: any;
    try {
      const authConfig = this.configService.getOrThrow<IAuthConfig>(
        CONFIG.AUTH,
      );
      decodedToken = this.jwtService.verify(token, {
        secret: authConfig.jwtSecret,
      });
    } catch (err) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    const userId = parseInt(decodedToken.sub);
    if (!userId || userId !== video.user_id) {
      res.status(403).json({ message: 'Unauthorized' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial status
    const initialStatus = {
      video_id: video.id,
      status: video.status,
      status_message: video.status_message,
      processed_at: video.processed_at?.toISOString() || null,
      timestamp: new Date().toISOString(),
    };

    res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

    // Get existing status logs and send them
    const existingLogs = await this.statusLogService.getStatusHistory(videoId);
    for (const log of existingLogs.reverse()) {
      const logData = {
        video_id: log.video_id,
        status: log.status,
        actor: log.actor,
        status_message: log.status_message,
        timestamp: (log as any).created_at.toISOString(),
      };
      res.write(`data: ${JSON.stringify(logData)}\n\n`);
    }

    // Poll for status changes
    let lastStatus = video.status;
    let lastLogId = existingLogs.length > 0 ? (existingLogs[0] as any).id : 0;
    const pollInterval = setInterval(async () => {
      try {
        // Check if client disconnected
        if (res.destroyed) {
          clearInterval(pollInterval);
          return;
        }

        // Get latest video status
        const currentVideo = await this.videoRepo.findOne({
          where: { id: videoId } as any,
        });

        if (!currentVideo) {
          clearInterval(pollInterval);
          res.write(
            `event: error\ndata: ${JSON.stringify({ message: 'Video not found' })}\n\n`,
          );
          res.end();
          return;
        }

        // Check for new status logs
        const newLogs = await this.statusLogRepo
          .createQueryBuilder('log')
          .where('log.video_id = :videoId', { videoId })
          .andWhere('log.id > :lastLogId', { lastLogId })
          .orderBy('log.created_at', 'DESC')
          .take(10)
          .getMany();

        if (newLogs.length > 0) {
          // Sort by ID to get the latest
          newLogs.sort((a, b) => (a as any).id - (b as any).id);
          const latestNewLog = newLogs[newLogs.length - 1];
          lastLogId = (latestNewLog as any).id;
          const logData = {
            video_id: latestNewLog.video_id,
            status: latestNewLog.status,
            actor: latestNewLog.actor,
            status_message: latestNewLog.status_message,
            timestamp: (latestNewLog as any).created_at.toISOString(),
          };
          res.write(`data: ${JSON.stringify(logData)}\n\n`);
        }

        // Check if status changed
        if (currentVideo.status !== lastStatus) {
          lastStatus = currentVideo.status;
          const statusUpdate = {
            video_id: currentVideo.id,
            status: currentVideo.status,
            status_message: currentVideo.status_message,
            processed_at: currentVideo.processed_at?.toISOString() || null,
            timestamp: new Date().toISOString(),
          };
          res.write(`data: ${JSON.stringify(statusUpdate)}\n\n`);
        }

        // Close connection if video reached terminal state
        if (
          currentVideo.status === VideoProcessingStatus.READY ||
          currentVideo.status === VideoProcessingStatus.FAILED
        ) {
          clearInterval(pollInterval);
          res.write(
            `event: close\ndata: ${JSON.stringify({ status: currentVideo.status })}\n\n`,
          );
          res.end();
          return;
        }
      } catch (error: any) {
        clearInterval(pollInterval);
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`,
        );
        res.end();
      }
    }, 2000); // Poll every 2 seconds

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(pollInterval);
    });
  }

  /**
   * Get in-progress or failed videos for the current user
   */
  @Get('my/processing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get in-progress and failed videos for current user',
  })
  @ApiQuery({ name: 'include_completed', required: false, type: Boolean })
  async getMyProcessingVideos(
    @Req() req: CustomExpressRequest,
    @Query('include_completed') includeCompleted?: string,
  ) {
    const userId = parseInt(req.user?.sub);
    if (!userId) {
      throw new Error('User not found in request');
    }

    // Get videos that are not ready (in progress or failed)
    const statuses = [
      VideoProcessingStatus.PENDING,
      VideoProcessingStatus.UPLOADING,
      VideoProcessingStatus.TRANSCODING,
      VideoProcessingStatus.TRANSCRIBING,
      VideoProcessingStatus.SUMMARIZING,
      VideoProcessingStatus.INDEXING,
      VideoProcessingStatus.FAILED,
    ];

    if (includeCompleted === 'true') {
      statuses.push(VideoProcessingStatus.READY);
    }

    // Use TypeORM In operator to properly handle enum array
    const videos = await this.videoRepo.find({
      where: {
        user_id: userId,
        status: In(statuses),
      } as any,
      order: { created_at: 'DESC' as any },
    });

    // Get status history for each video
    const videosWithHistory = await Promise.all(
      videos.map(async (video) => {
        const history = await this.statusLogService.getStatusHistory(video.id);
        return {
          ...video,
          status_history: history.map((log) => ({
            status: log.status,
            actor: log.actor,
            status_message: log.status_message,
            timestamp:
              (log as any).created_at?.toISOString() ||
              new Date().toISOString(),
          })),
        };
      }),
    );

    return {
      message: 'Processing videos retrieved successfully',
      data: {
        videos: videosWithHistory,
        total: videos.length,
      },
    };
  }
}
