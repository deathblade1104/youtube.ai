import { JobsOptions } from 'bullmq';

// Queue names
export const VIDEO_TRANSCODE_QUEUE = 'video_transcode_queue';
export const VIDEO_TRANSCRIBE_QUEUE = 'video_transcribe_queue';
export const VIDEO_TRANSCODE_DLQ = 'video_transcode_dlq';
export const VIDEO_TRANSCRIBE_DLQ = 'video_transcribe_dlq';
export const OUTBOX_PUBLISHER_QUEUE = 'outbox_publisher_queue';

// Job names
export const TRANSCODE_VIDEO_JOB = 'transcode_video';
export const TRANSCRIBE_VIDEO_JOB = 'transcribe_video';
export const PUBLISH_OUTBOX_JOB = 'publish_outbox';

// Job options with retries and exponential backoff
export const TRANSCODE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5 * 1000, // Start with 5 seconds
  },
  removeOnComplete: true,
  removeOnFail: false, // Keep failed jobs for DLQ
};

export const TRANSCRIBE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10 * 1000, // Start with 10 seconds (transcription takes longer)
  },
  removeOnComplete: true,
  removeOnFail: false, // Keep failed jobs for DLQ
};

export const OUTBOX_PUBLISHER_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2 * 1000, // Start with 2 seconds
  },
  removeOnComplete: true,
  removeOnFail: false,
};

// Worker concurrency
export const TRANSCODE_WORKER_CONCURRENCY = 2; // Process 2 videos concurrently
export const TRANSCRIBE_WORKER_CONCURRENCY = 1; // Process 1 transcription at a time (CPU intensive)
export const OUTBOX_PUBLISHER_CONCURRENCY = 5; // Publish 5 events concurrently

// Temporary directory for video processing
export const TEMP_DIR = '/tmp/video-processing';

// Export constants object for convenient access
export const VIDEO_PROCESSOR_CONSTANTS = {
  TEMP_DIR,
} as const;

