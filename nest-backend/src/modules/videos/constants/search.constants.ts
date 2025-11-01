import { JobsOptions } from 'bullmq';

// Queue names
export const VIDEO_SEARCH_INDEX_QUEUE = 'video_search_index_queue';

// Job names
export const INDEX_VIDEO_JOB = 'index_video';

// Job options
export const INDEX_VIDEO_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2 * 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

// Worker concurrency
export const INDEX_WORKER_CONCURRENCY = 5;

// OpenSearch index name
export const VIDEO_SEARCH_INDEX = 'videos';

