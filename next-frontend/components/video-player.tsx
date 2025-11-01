'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

interface VideoPlayerProps {
  url: string
  type?: string
  hls?: boolean
  onQualityChange?: (quality: string) => void
  qualityOptions?: Array<{ resolution: string; width: number; height: number }>
  currentQuality?: string
}

export function VideoPlayer({
  url,
  type = 'video/mp4',
  hls = false,
  qualityOptions = [],
  currentQuality,
  onQualityChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showQualityMenu, setShowQualityMenu] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (video) {
        video.src = ''
        video.load()
      }
    }

    if (hls && (type === 'application/vnd.apple.mpegurl' || url.endsWith('.m3u8'))) {
      if (Hls.isSupported()) {
        const hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        })

        hlsRef.current = hlsInstance
        hlsInstance.loadSource(url)
        hlsInstance.attachMedia(video)

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
        })

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network error: Failed to load HLS stream')
                hlsInstance.recoverMediaError()
                break
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media error: Failed to decode HLS stream')
                hlsInstance.recoverMediaError()
                break
              default:
                setError(`HLS error: ${data.type}`)
                hlsInstance.destroy()
            }
            setLoading(false)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
        video.addEventListener('loadedmetadata', () => setLoading(false))
        video.addEventListener('error', () => {
          setError('Failed to load HLS stream')
          setLoading(false)
        })
      } else {
        setError('HLS is not supported in this browser')
        setLoading(false)
      }
    } else {
      video.src = url
      video.load()
      const handleLoadedMetadata = () => setLoading(false)
      const handleCanPlay = () => setLoading(false)
      const handleError = () => {
        const videoError = video.error
        if (videoError) {
          let errorMsg = 'Unknown video error'
          switch (videoError.code) {
            case videoError.MEDIA_ERR_ABORTED:
              errorMsg = 'Video playback was aborted'
              break
            case videoError.MEDIA_ERR_NETWORK:
              errorMsg = 'Network error: Failed to load video'
              break
            case videoError.MEDIA_ERR_DECODE:
              errorMsg = 'Video decode error'
              break
            case videoError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMsg = 'Video format not supported'
              break
          }
          setError(errorMsg)
        } else {
          setError('Unknown video error')
        }
        setLoading(false)
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('error', handleError)

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('error', handleError)
        cleanup()
      }
    }

    return cleanup
  }, [url, type, hls])

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden group">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading video...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 text-white p-4 text-center z-10">
          <div>
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={() => {
                setError('')
                setLoading(true)
                if (videoRef.current) {
                  videoRef.current.load()
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        className="w-full aspect-video"
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
      >
        Your browser does not support the video tag.
      </video>

      {/* Quality Selector (if HLS) */}
      {hls && qualityOptions.length > 0 && (
        <div className="absolute bottom-16 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="px-3 py-1.5 bg-black bg-opacity-75 text-white text-sm rounded hover:bg-opacity-90 flex items-center space-x-1"
            >
              <span>{currentQuality || 'Auto'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showQualityMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-black bg-opacity-90 rounded overflow-hidden min-w-[120px]">
                <button
                  onClick={() => {
                    onQualityChange?.('auto')
                    setShowQualityMenu(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 ${
                    currentQuality === 'auto' ? 'bg-white bg-opacity-20' : ''
                  }`}
                >
                  Auto
                </button>
                {qualityOptions.map((quality) => (
                  <button
                    key={quality.resolution}
                    onClick={() => {
                      onQualityChange?.(quality.resolution)
                      setShowQualityMenu(false)
                    }}
                    className={`w-full px-4 py-2 text-left text-sm text-white hover:bg-white hover:bg-opacity-20 ${
                      currentQuality === quality.resolution ? 'bg-white bg-opacity-20' : ''
                    }`}
                  >
                    {quality.resolution}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

