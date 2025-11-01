'use client'

import { cn } from '@/lib/utils/cn'

interface StatusEntry {
  status: string
  actor: string
  status_message: string | null
  timestamp: string
}

interface StatusTimelineProps {
  entries: StatusEntry[]
  currentStatus?: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500 text-white border-yellow-400',
  uploading: 'bg-blue-500 text-white border-blue-400',
  transcoding: 'bg-purple-500 text-white border-purple-400',
  transcribing: 'bg-indigo-500 text-white border-indigo-400',
  summarizing: 'bg-pink-500 text-white border-pink-400',
  indexing: 'bg-green-500 text-white border-green-400',
  ready: 'bg-emerald-500 text-white border-emerald-400',
  failed: 'bg-red-500 text-white border-red-400',
}

const statusIcons: Record<string, string> = {
  pending: '⏳',
  uploading: '📤',
  transcoding: '🎬',
  transcribing: '🎙️',
  summarizing: '📝',
  indexing: '🔍',
  ready: '✅',
  failed: '❌',
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  uploading: 'Uploading',
  transcoding: 'Transcoding',
  transcribing: 'Transcribing',
  summarizing: 'Summarizing',
  indexing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
}

export function StatusTimeline({ entries, currentStatus }: StatusTimelineProps) {
  if (entries.length === 0 && !currentStatus) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-600 mx-auto mb-4"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for status updates...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {currentStatus && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg', statusColors[currentStatus])}>
              {statusIcons[currentStatus] || '⚪'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{statusLabels[currentStatus] || currentStatus}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Current Status</p>
            </div>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-green-200 dark:from-blue-800 dark:via-purple-800 dark:to-green-800"></div>

          {/* Timeline items */}
          <div className="space-y-6">
            {entries.map((entry, index) => {
              const isLast = index === entries.length - 1
              return (
                <div key={`${entry.timestamp}-${index}`} className="relative flex items-start space-x-4">
                  <div className={cn(
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-lg transition-all duration-300',
                    statusColors[entry.status] || 'bg-gray-500 text-white border-gray-400',
                    isLast && 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400'
                  )}>
                    {statusIcons[entry.status] || '⚪'}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {statusLabels[entry.status] || entry.status}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {entry.status_message && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 leading-relaxed">
                        {entry.status_message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                      by {entry.actor}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

