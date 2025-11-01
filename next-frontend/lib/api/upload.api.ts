/**
 * Upload API endpoints
 */
import { apiClient } from './client'

export interface InitUploadData {
  filename: string
  content_type: string
  has_custom_thumbnail?: boolean
}

export interface PresignedUrlData {
  key: string
  upload_id: string
  part_number: number
}

export interface CompleteUploadData {
  key: string
  upload_id: string
  parts: Array<{ ETag: string; PartNumber: number }>
}

export interface SaveVideoData {
  title: string
  description: string
  key: string
  thumbnail_key?: string
}

export interface AbortUploadData {
  upload_id: string
  key: string
}

export interface UploadThumbnailData {
  filename: string
  content_type: string
  video_id: number
}

export const uploadAPI = {
  init: async (data: InitUploadData) => {
    const response = await apiClient.post('/upload/init', data)
    return response.data
  },
  presignedUrl: async (data: PresignedUrlData) => {
    const response = await apiClient.post('/upload/presigned-url', data)
    return response.data
  },
  complete: async (data: CompleteUploadData) => {
    const response = await apiClient.post('/upload/complete', data)
    return response.data
  },
  save: async (data: SaveVideoData) => {
    const response = await apiClient.post('/upload/save', data)
    return response.data
  },
  abort: async (data: AbortUploadData) => {
    const response = await apiClient.post('/upload/abort', data)
    return response.data
  },
  uploadThumbnail: async (data: UploadThumbnailData) => {
    const response = await apiClient.post('/upload/thumbnail', data)
    return response.data
  },
}

