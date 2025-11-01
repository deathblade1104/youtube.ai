import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  MessageEvent,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { from, merge, Observable, Subject } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { In, Repository } from 'typeorm';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SseJwtAuthGuard } from '../../../common/guards/sse-jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import { Videos } from '../entities/video.entity';
import { VideoStatusEventService } from '../services/shared/video-status-event.service';
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
    private readonly statusLogService: VideoStatusLogService,
    private readonly statusEventService: VideoStatusEventService,
  ) {}

  /**
   * SSE endpoint to stream video status changes in real-time
   * Uses NestJS @Sse decorator with RxJS Observables for event-driven updates
   * Note: EventSource doesn't support custom headers, so token is passed as query param
   */
  @Get('status/:id/stream')
  @Sse()
  @UseGuards(SseJwtAuthGuard)
  @ApiOperation({
    summary: 'Stream video status changes via Server-Sent Events',
    description: 'Event-driven SSE stream using RxJS Observables. No polling.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'JWT token for authentication',
  })
  async streamVideoStatus(
    @Param('id', ParseIntPipe) videoId: number,
    @Req() req: CustomExpressRequest,
  ): Promise<Observable<MessageEvent>> {
    const userId = parseInt(req.user?.sub);

    // Verify video exists and user owns it
    const video = await this.videoRepo.findOne({
      where: { id: videoId } as any,
    });

    if (!video) {
      throw new HttpException('Video not found', HttpStatus.NOT_FOUND);
    }

    if (!userId || userId !== video.user_id) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }

    // Get existing status logs for initial history
    const existingLogs = await this.statusLogService.getStatusHistory(videoId);

    // Create initial status update
    const initialStatus: MessageEvent = {
      data: {
        video_id: video.id,
        status: video.status,
        status_message: video.status_message,
        processed_at: video.processed_at?.toISOString() || null,
        timestamp: new Date().toISOString(),
      },
    };

    // Create initial history updates (oldest to newest)
    const historyUpdates = existingLogs.reverse().map((log) => ({
      data: {
        video_id: log.video_id,
        status: log.status,
        actor: log.actor,
        status_message: log.status_message,
        timestamp:
          (log as any).created_at?.toISOString() || new Date().toISOString(),
      },
    })) as MessageEvent[];

    // Get the real-time status stream for this video
    const statusStream = this.statusEventService.getStatusStream(videoId);

    // Create a subject to signal when to close the stream
    const closeSignal = new Subject<void>();

    // Transform status updates to MessageEvent format
    const realTimeUpdates = statusStream.pipe(
      map((update) => {
        // Check if this is a terminal state
        if (
          update.status === VideoProcessingStatus.READY ||
          update.status === VideoProcessingStatus.FAILED
        ) {
          // Signal stream to close
          setTimeout(() => {
            closeSignal.next();
            closeSignal.complete();
          }, 100);

          return {
            event: 'close',
            data: update,
          } as MessageEvent;
        }
        return {
          data: update,
        } as MessageEvent;
      }),
    );

    // Combine initial status, history, and real-time updates as Observables
    const allUpdates = [
      from([initialStatus, ...historyUpdates]),
      realTimeUpdates,
    ];

    // Merge all streams
    return merge(...allUpdates).pipe(
      // Close stream when terminal state is reached
      takeUntil(closeSignal),
      catchError((error) => {
        // Emit error event
        return from([
          {
            event: 'error',
            data: {
              message: error.message,
            },
          } as MessageEvent,
        ]);
      }),
      finalize(() => {
        // Cleanup when stream completes
        this.statusEventService.closeStream(videoId);
      }),
    );
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
