'use client'

import { formatRelativeTime } from '@/lib/utils/formatters'
import { Card } from '@/components/ui/card'
import { VideoWatchData } from '@/lib/types'

interface VideoInfoPanelProps {
  data: VideoWatchData
}

export function VideoInfoPanel({ data }: VideoInfoPanelProps) {
  const { video, summary, captions } = data

  return (
    <div className="space-y-4">
      {/* Video Title and Meta */}
      <Card>
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {video.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{video.user_name || 'Unknown'}</span>
            <span>•</span>
            <span>{formatRelativeTime(video.created_at)}</span>
            {captions?.duration_seconds && (
              <>
                <span>•</span>
                <span>{Math.floor(captions.duration_seconds / 60)} min</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Description */}
      {video.description && (
        <Card>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Description</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {video.description}
            </p>
          </div>
        </Card>
      )}

      {/* Summary */}
      {summary?.summary_text && (
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h2>
              {summary.quality_score && (
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
                  Quality: {summary.quality_score.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {summary.summary_text}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}

