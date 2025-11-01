'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface QualityOption {
  resolution: string
  width: number
  height: number
  bitrate?: number
  size_bytes?: number
}

interface VideoQualitySelectorProps {
  qualities: QualityOption[]
  currentQuality?: string
  onQualityChange: (quality: string) => void
}

export function VideoQualitySelector({
  qualities,
  currentQuality,
  onQualityChange,
}: VideoQualitySelectorProps) {
  if (qualities.length <= 1) return null

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
      {qualities.map((quality) => (
        <Button
          key={quality.resolution}
          variant={currentQuality === quality.resolution ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onQualityChange(quality.resolution)}
          className={cn(
            'w-full min-w-[120px]',
            currentQuality === quality.resolution && 'ring-2 ring-blue-500'
          )}
        >
          {quality.resolution}
        </Button>
      ))}
    </div>
  )
}

