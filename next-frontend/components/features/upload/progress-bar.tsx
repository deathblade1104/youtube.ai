'use client'

import { cn } from '@/lib/utils/cn'

interface ProgressBarProps {
  progress: number
  status?: string
  className?: string
}

export function ProgressBar({ progress, status, className }: ProgressBarProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {status && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{status}</p>
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 rounded-full transition-all duration-300 ease-out shadow-sm relative overflow-hidden"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        </div>
      </div>
    </div>
  )
}

