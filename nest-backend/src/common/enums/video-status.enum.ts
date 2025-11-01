/**
 * Video Processing Status Enum
 * Tracks the overall processing state of a video through the pipeline
 */
export enum VideoProcessingStatus {
  UPLOADING = 'uploading', // Multipart upload in progress
  PENDING = 'pending', // Uploaded, waiting for processing
  TRANSCODING = 'transcoding', // Being transcoded to variants
  TRANSCRIBING = 'transcribing', // Being transcribed
  SUMMARIZING = 'summarizing', // Being summarized (Python backend)
  INDEXING = 'indexing', // Being indexed in OpenSearch
  READY = 'ready', // Fully processed and available
  FAILED = 'failed', // Failed at any stage
}

