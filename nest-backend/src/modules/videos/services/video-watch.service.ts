import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { VideoSummary } from '../../../database/postgres/entities/video-summary.entity';
import { VideoTranscript } from '../../../database/postgres/entities/video-transcript.entity';
import { VideoVariant, VideoResolution } from '../../../database/postgres/entities/video-variant.entity';
import { Videos } from '../entities/video.entity';
import { VideoInfoService } from './video-info.service';

@Injectable()
export class VideoWatchService {
  private readonly logger = new Logger(VideoWatchService.name);
  private readonly summaryRepository: GenericCrudRepository<VideoSummary>;
  private readonly transcriptRepository: GenericCrudRepository<VideoTranscript>;
  private readonly variantRepository: GenericCrudRepository<VideoVariant>;

  constructor(
    @InjectRepository(VideoSummary)
    private readonly summaryRepo: Repository<VideoSummary>,
    @InjectRepository(VideoTranscript)
    private readonly transcriptRepo: Repository<VideoTranscript>,
    @InjectRepository(VideoVariant)
    private readonly variantRepo: Repository<VideoVariant>,
    private readonly videoInfoService: VideoInfoService,
  ) {
    this.summaryRepository = new GenericCrudRepository(summaryRepo, VideoSummary.name);
    this.transcriptRepository = new GenericCrudRepository(transcriptRepo, VideoTranscript.name);
    this.variantRepository = new GenericCrudRepository(variantRepo, VideoVariant.name);
  }

  /**
   * Get complete video watch data: summary, transcript (for captions), quality options
   */
  async getVideoWatchData(videoId: number) {
    // Get basic video info
    const videoInfo = await this.videoInfoService.getVideoInfo(videoId);

    // Get AI summary
    const summary = await this.summaryRepository.findOneOrNone({
      where: { video_id: videoId } as any,
    });

    // Get transcript (for captions)
    const transcript = await this.transcriptRepository.findOneOrNone({
      where: { video_id: videoId } as any,
    });

    // Get all available quality variants
    const variants = await this.variantRepository.findAll({
      where: { video_id: videoId } as any,
    });

    // Get thumbnail
    const thumbnailUrl = await this.videoInfoService.getThumbnailUrl(videoId);

    return {
      message: 'Video watch data retrieved successfully',
      data: {
        video: videoInfo,
        uploader: (videoInfo as any).uploader, // Include uploader info from videoInfo
        summary: summary
          ? {
              summary_text: summary.summary_text,
              summary_path: summary.summary_path,
              quality_score: summary.quality_score,
              model_info: summary.model_info,
            }
          : null,
        captions: transcript
          ? {
              transcript_text: transcript.transcript_text,
              transcript_path: transcript.transcript_path,
              duration_seconds: transcript.duration_seconds,
              status: transcript.status,
            }
          : null,
        quality_options: variants.map((v) => ({
          resolution: v.resolution,
          width: v.width,
          height: v.height,
          bitrate: v.bitrate,
          size_bytes: v.size_bytes,
        })),
        thumbnail_url: thumbnailUrl,
      },
    };
  }
}

