'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils/formatters'
import { Video } from '@/lib/types'
import { cn } from '@/lib/utils/cn'

interface VideoCardProps {
  video: Video
}

const statusColors: Record<string, string> = {
  ready: 'bg-emerald-500/90 text-white',
  failed: 'bg-red-500/90 text-white',
  uploading: 'bg-yellow-500/90 text-white',
  transcoding: 'bg-blue-500/90 text-white',
  transcribing: 'bg-purple-500/90 text-white',
  indexing: 'bg-indigo-500/90 text-white',
}

export function VideoCard({ video }: VideoCardProps) {
  const statusColor = statusColors[video.status] || 'bg-gray-500/90 text-white'

  return (
    <Link href={`/videos/${video.id}`}>
      <Card
        hover
        padding="none"
        className="overflow-hidden group cursor-pointer h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 border-gray-200/50 dark:border-gray-700/50"
      >
        {/* Thumbnail */}
        <div className="relative aspect-video w-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 dark:from-gray-700 dark:via-gray-800 dark:to-gray-900 overflow-hidden rounded-t-xl">
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
              <svg
                className="w-16 h-16 text-gray-400 dark:text-gray-500 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Play Icon Overlay on Hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 backdrop-blur-[2px]">
            <div className="w-16 h-16 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-xl">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Status Badge */}
          <div className="absolute bottom-3 right-3">
            <span
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md shadow-lg uppercase tracking-wide border border-white/20',
                statusColor
              )}
            >
              {video.status}
            </span>
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col bg-white dark:bg-gray-800">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 leading-tight">
            {video.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1 leading-relaxed">
            {video.description || 'No description available'}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700/50">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{video.user_name || 'Unknown'}</span>
            <span className="text-gray-500 dark:text-gray-400">{formatRelativeTime(video.created_at)}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

