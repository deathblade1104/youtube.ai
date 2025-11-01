import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Req,
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
import { In, Repository } from 'typeorm';
import {
  Direction as PaginationDirection,
  PaginationDto,
} from '../../../common/dtos/opensearch-pagination.dto';
import { PaginationQueryDto } from '../../../common/dtos/pagination.dto';
import { VideoProcessingStatus } from '../../../common/enums/video-status.enum';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import { VideoTranscript } from '../../../database/postgres/entities/video-transcript.entity';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { Videos } from '../entities/video.entity';
import { VideoSearchService } from '../services/search/video-search.service';
import { VideoDeletionService } from '../services/video-deletion.service';
import { VideoInfoService } from '../services/video-info.service';
import { VideoWatchService } from '../services/video-watch.service';
import { WatchService } from '../services/watch/watch.service';

@Controller({ path: 'videos', version: '1' })
@ApiTags('Videos Controller')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideosController {
  private readonly videoRepository: GenericCrudRepository<Videos>;

  private readonly transcriptRepository: GenericCrudRepository<VideoTranscript>;

  constructor(
    @InjectRepository(Videos)
    private readonly videoRepo: Repository<Videos>,
    @InjectRepository(VideoTranscript)
    private readonly transcriptRepo: Repository<VideoTranscript>,
    private readonly videoSearchService: VideoSearchService,
    private readonly videoInfoService: VideoInfoService,
    private readonly watchService: WatchService,
    private readonly videoWatchService: VideoWatchService,
    private readonly videoDeletionService: VideoDeletionService,
  ) {
    this.videoRepository = new GenericCrudRepository(videoRepo, Videos.name);
    this.transcriptRepository = new GenericCrudRepository(
      transcriptRepo,
      VideoTranscript.name,
    );
  }

  @Get('list')
  @ApiOperation({ summary: 'List ready videos (paginated from PostgreSQL)' })
  async listVideos(@Query() pagination: PaginationQueryDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Only return videos with status 'ready'
    const result = await this.videoRepository.findAllAndCount({
      where: { status: VideoProcessingStatus.READY } as any,
      take: limit,
      skip,
      order: { created_at: 'desc' } as any,
    });

    const items = result.items;
    const total = result.total;

    // Enhance with thumbnail URLs
    const enhancedItems =
      await this.videoInfoService.enhanceVideosWithThumbnails(items);

    return {
      message: 'Videos retrieved successfully',
      data: {
        items: enhancedItems,
        total,
        page,
        limit,
      },
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search videos in OpenSearch' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'direction', required: false, enum: ['next', 'previous'] })
  async searchVideos(
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('direction') direction?: 'next' | 'previous',
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    // Convert page/limit to cursor-based pagination if needed
    // For now, we'll use simple offset-based approach by converting page to size
    const pagination: PaginationDto = {
      direction: (direction as any) || PaginationDirection.NEXT,
      cursor: cursor,
      size: limit ? parseInt(limit, 10) : 10,
    };

    const result = await this.videoSearchService.searchVideos(
      query,
      pagination,
    );

    // Fetch full video details from DB using video_id
    const videoIds = result.data.map((item) => item.video_id);

    if (videoIds.length === 0) {
      return {
        message: 'Search completed successfully',
        data: {
          pagination: result.pagination,
          items: [],
        },
      };
    }

    const videos = await this.videoRepo.find({
      where: { id: In(videoIds) } as any,
    });

    // Map search results with full video data, preserving order
    const videoMap = new Map(videos.map((v) => [v.id, v]));
    const items = result.data
      .map((searchDoc) => videoMap.get(searchDoc.video_id))
      .filter(Boolean) as Videos[];

    // Enhance with thumbnail URLs
    const enhancedItems =
      await this.videoInfoService.enhanceVideosWithThumbnails(items);

    return {
      message: 'Search completed successfully',
      data: {
        pagination: result.pagination,
        items: enhancedItems,
      },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get complete video watch data (info, summary, captions, quality options)',
  })
  @ApiParam({ name: 'id', type: Number })
  async getVideoWatchData(@Param('id', ParseIntPipe) id: number) {
    return await this.videoWatchService.getVideoWatchData(id);
  }

  @Get(':id/info')
  @ApiOperation({
    summary: 'Get basic video info by ID (description and uploader info)',
  })
  @ApiParam({ name: 'id', type: Number })
  async getVideoInfo(@Param('id', ParseIntPipe) id: number) {
    return await this.videoInfoService.getVideoInfo(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get video processing status' })
  @ApiParam({ name: 'id', type: Number })
  async getVideoStatus(@Param('id', ParseIntPipe) id: number) {
    return await this.videoInfoService.getVideoStatus(id);
  }

  @Get(':id/watch')
  @ApiOperation({ summary: 'Get video watch URL (HLS manifest)' })
  @ApiParam({ name: 'id', type: Number })
  async getWatchUrl(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CustomExpressRequest,
  ) {
    // Verify video exists
    const video = await this.videoRepository.findOneOrNone({
      where: { id } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${id} not found`);
    }

    // Check if video is ready
    if (video.status !== VideoProcessingStatus.READY) {
      throw new NotFoundException(
        `Video ${id} is not ready for watching. Current status: ${video.status}`,
      );
    }

    // Check if video has HLS variants (new format) or MP4 variants (old format)
    const variant = await this.watchService.getBestQualityVariant(id);
    if (!variant) {
      throw new NotFoundException(`No video variants found for video ${id}`);
    }

    // Check if variant uses HLS (key ends with .m3u8) or old MP4 format
    const hasHLS = variant.key.endsWith('.m3u8');

    if (hasHLS) {
      // Return HLS manifest URL for new HLS-encoded videos
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:8080';
      const baseUrl = `${protocol}://${host}`;

      // Get token from Authorization header if available
      const token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : undefined;

      // Generate HLS manifest URL with token if available
      const manifestUrl = token
        ? `${baseUrl}/api/v1/watch/hls/${id}/master.m3u8?token=${encodeURIComponent(token)}`
        : `${baseUrl}/api/v1/watch/hls/${id}/master.m3u8`;

      return {
        message: 'Watch URL retrieved successfully',
        data: {
          url: manifestUrl,
          type: 'application/vnd.apple.mpegurl', // HLS manifest
          hls: true,
        },
      };
    } else {
      // Fallback: Return direct MP4 URL for old videos (pre-HLS)
      // Get presigned URL for the MP4 file
      const presignedUrl = await this.watchService.getVariantSegmentUrl(
        id,
        variant.resolution,
      );

      return {
        message: 'Watch URL retrieved successfully',
        data: {
          url: presignedUrl,
          type: 'video/mp4', // Direct MP4 playback
          hls: false,
        },
      };
    }
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get video transcript' })
  @ApiParam({ name: 'id', type: Number })
  async getTranscript(@Param('id', ParseIntPipe) id: number) {
    // Verify video exists
    const video = await this.videoRepository.findOneOrNone({
      where: { id } as any,
    });

    if (!video) {
      throw new NotFoundException(`Video ${id} not found`);
    }

    // Get transcript
    const transcript = await this.transcriptRepository.findOneOrNone({
      where: { video_id: id } as any,
    });

    if (!transcript) {
      throw new NotFoundException(
        `Transcript not found for video ${id}. Video may not be fully processed yet.`,
      );
    }

    return {
      message: 'Transcript retrieved successfully',
      data: {
        video_id: transcript.video_id,
        transcript_text: transcript.transcript_text,
        transcript_path: transcript.transcript_path,
        status: transcript.status,
        duration_seconds: transcript.duration_seconds,
        model_info: transcript.model_info,
      },
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete or cancel a video (handles both in-progress uploads and existing videos)',
  })
  @ApiParam({ name: 'id', type: Number })
  async deleteVideo(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = parseInt(req.user.sub);
    await this.videoDeletionService.deleteVideo(id, userId);
    return {
      message: 'Video deleted successfully',
      data: { videoId: id },
    };
  }
}
