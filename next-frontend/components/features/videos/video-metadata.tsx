'use client'

import { formatRelativeTime, formatDuration } from '@/lib/utils/formatters'
import { VideoWatchData } from '@/lib/types'

interface VideoMetadataProps {
  data: VideoWatchData
}

export function VideoMetadata({ data }: VideoMetadataProps) {
  const { video, captions } = data

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="font-medium">{video.user_name || 'Unknown'}</span>
      </div>
      <span>•</span>
      <div className="flex items-center gap-1.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{formatRelativeTime(video.created_at)}</span>
      </div>
      {captions?.duration_seconds && (
        <>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDuration(captions.duration_seconds)}</span>
          </div>
        </>
      )}
    </div>
  )
}

