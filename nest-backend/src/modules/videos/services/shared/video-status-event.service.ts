import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { VideoStatusLog } from '../../../../database/postgres/entities/video-status-log.entity';

export interface VideoStatusUpdate {
  video_id: number;
  status: string;
  status_message?: string | null;
  actor?: string;
  processed_at?: string | null;
  timestamp: string;
}

/**
 * Service for managing real-time video status updates via SSE
 * Uses RxJS Subjects to emit events when status changes occur
 */
@Injectable()
export class VideoStatusEventService implements OnModuleDestroy {
  private readonly logger = new Logger(VideoStatusEventService.name);

  // Map of videoId -> Subject for that video's status updates
  private readonly statusSubjects = new Map<number, Subject<VideoStatusUpdate>>();

  /**
   * Get or create an Observable stream for a video's status updates
   */
  getStatusStream(videoId: number): Observable<VideoStatusUpdate> {
    if (!this.statusSubjects.has(videoId)) {
      this.statusSubjects.set(videoId, new Subject<VideoStatusUpdate>());
      this.logger.debug(`Created status stream for video ${videoId}`);
    }
    return this.statusSubjects.get(videoId)!.asObservable();
  }

  /**
   * Emit a status update for a specific video
   */
  emitStatusUpdate(videoId: number, update: VideoStatusUpdate): void {
    const subject = this.statusSubjects.get(videoId);
    if (subject) {
      subject.next(update);
      this.logger.debug(`Emitted status update for video ${videoId}: ${update.status}`);
    } else {
      this.logger.debug(`No active subscribers for video ${videoId}, skipping emit`);
    }
  }

  /**
   * Emit status update from a status log entry
   */
  emitFromStatusLog(log: VideoStatusLog, videoStatus?: string, processedAt?: Date | null): void {
    const update: VideoStatusUpdate = {
      video_id: log.video_id,
      status: videoStatus || log.status,
      actor: log.actor,
      status_message: log.status_message,
      processed_at: processedAt?.toISOString() || null,
      timestamp: (log as any).created_at?.toISOString() || new Date().toISOString(),
    };
    this.emitStatusUpdate(log.video_id, update);
  }

  /**
   * Close and cleanup stream for a video
   */
  closeStream(videoId: number): void {
    const subject = this.statusSubjects.get(videoId);
    if (subject) {
      subject.complete();
      this.statusSubjects.delete(videoId);
      this.logger.debug(`Closed status stream for video ${videoId}`);
    }
  }

  /**
   * Cleanup all streams on module destroy
   */
  onModuleDestroy(): void {
    this.logger.log('Cleaning up all video status streams');
    for (const [videoId, subject] of this.statusSubjects.entries()) {
      subject.complete();
    }
    this.statusSubjects.clear();
  }
}

