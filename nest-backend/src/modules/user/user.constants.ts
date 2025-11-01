import { JobsOptions } from 'bullmq';
export const USER_EMAIL_BLOOM_FILTER_KEY = 'user_email_bloom_filter';
export const USER_EMAIL_BLOOM_FILTER_CAPACITY = 10000;
export const USER_EMAIL_BLOOM_FILTER_ERROR_RATE = 0.01;
export const SYNC_USER_EMAILS_BATCH_SIZE = 1000;
export const SYNC_USER_EMAILS_IMMEDIATE_JOB_NAME = 'sync_user_emails_immediate';
export const SYNC_USER_EMAILS_DAILY_MIDNIGHT_JOB_NAME =
  'sync_user_emails_daily_midnight';
export const SYNC_USER_EMAILS_JOB_QUEUE = 'sync_user_emails_queue';

export const SYNC_USER_EMAILS_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5 * 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

export const SYNC_USER_EMAILS_REPEAT_OPTIONS = {
  pattern: '0 0 * * *', // Run at midnight (00:00) every day
  tz: 'UTC',
};
