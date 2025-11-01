'use client'

import { Card } from '@/components/ui/card'
import { VideoWatchData } from '@/lib/types'

interface VideoTranscriptPanelProps {
  data: VideoWatchData
  isOpen: boolean
}

export function VideoTranscriptPanel({ data, isOpen }: VideoTranscriptPanelProps) {
  const { captions } = data

  if (!isOpen || !captions?.transcript_text) {
    return null
  }

  return (
    <Card className="max-h-[600px] overflow-y-auto">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Transcript</h2>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {captions.transcript_text}
          </p>
        </div>
      </div>
    </Card>
  )
}

