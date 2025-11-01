import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenericWorkerHost } from '../../../providers/bullmq/generic/genericWorkerHost';
import {
  INDEX_WORKER_CONCURRENCY,
  VIDEO_SEARCH_INDEX_QUEUE,
} from '../constants/search.constants';
import { VideoSearchIndexService } from '../services/search/video-search-index.service';

export interface IVideoIndexData {
  videoId: number;
}

@Processor(VIDEO_SEARCH_INDEX_QUEUE, {
  concurrency: INDEX_WORKER_CONCURRENCY,
})
@Injectable()
export class VideoIndexProcessor extends GenericWorkerHost<
  IVideoIndexData,
  void
> {
  constructor(
    private readonly videoSearchIndexService: VideoSearchIndexService,
  ) {
    super(VIDEO_SEARCH_INDEX_QUEUE, VideoIndexProcessor.name);
  }

  protected getJobContext(job: Job<IVideoIndexData>): string {
    return `, videoId=${job.data.videoId}`;
  }

  protected async processJob(job: Job<IVideoIndexData>): Promise<void> {
    const { videoId } = job.data;

    await this.videoSearchIndexService.indexVideo(videoId);

    this.logger.log(`✅ Successfully indexed video: videoId=${videoId}`);
  }
}

