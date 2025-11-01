/**
 * Shared TypeScript types and interfaces
 */

export interface Video {
  id: number
  title: string
  description: string
  status: string
  user_name: string
  created_at: string
  thumbnail_url?: string | null
  duration_seconds?: number
  view_count?: number
}

export interface VideoWatchData {
  video: {
    id: number
    title: string
    description: string
    status: string
    user_name: string
    created_at: string
    thumbnail_url?: string | null
  }
  uploader?: {
    id: number
    name: string
    email: string | null
  }
  summary: {
    summary_text?: string
    summary_path?: string
    quality_score?: number
    model_info?: Record<string, any>
  } | null
  captions: {
    transcript_text?: string
    transcript_path?: string
    duration_seconds?: number
    status?: string
  } | null
  quality_options: Array<{
    resolution: string
    width: number
    height: number
    bitrate?: number
    size_bytes?: number
  }>
  thumbnail_url?: string | null
}

export interface AutocompleteSuggestion {
  text: string
  video_id: number
  thumbnail_url: string | null
}

export interface Comment {
  id: number
  content: string
  user_id: number
  user_name: string | null
  video_id: number
  parent_id: number | null
  likes: number
  has_liked: boolean
  is_edited: boolean
  edited_at: string | null
  created_at: string
  replies?: Comment[]
}

export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ApiResponse<T = any> {
  success?: boolean
  message?: string
  data?: T
  status_code?: number
}

export type VideoProcessingStatus =
  | 'uploading'
  | 'transcoding'
  | 'transcribing'
  | 'indexing'
  | 'ready'
  | 'failed'

