'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { VideoPlayer } from '@/components/video-player'
import { CommentsSection } from '@/components/comments-section'
import { videoAPI } from '@/lib/api'

interface VideoWatchData {
  video: {
    id: number
    title: string
    description: string
    status: string
    user_name: string
    created_at: string
    thumbnail_url?: string | null
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

export default function VideoWatchPage() {
  const params = useParams()
  const videoId = Number(params.id)
  const [watchData, setWatchData] = useState<VideoWatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedQuality, setSelectedQuality] = useState<string>('auto')
  const [watchUrl, setWatchUrl] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(true)
  const [showCaptions, setShowCaptions] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')

        // Fetch watch data (includes video info, summary, captions, quality options)
        const data = await videoAPI.getWatchData(videoId)
        setWatchData(data)

        // Fetch watch URL (HLS manifest)
        if (data.video.status === 'ready') {
          try {
            const watchResponse = await videoAPI.getWatchUrl(videoId)
            if (watchResponse.url) {
              setWatchUrl(watchResponse.url)
            }
          } catch (err) {
            console.error('Error fetching watch URL:', err)
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load video')
      } finally {
        setLoading(false)
      }
    }

    if (videoId) {
      fetchData()
    }
  }, [videoId])

  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality)
    // In a real implementation, you'd switch the video quality here
    // For now, we'll just update the state
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">Loading video...</div>
        </div>
      </div>
    )
  }

  if (error || !watchData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
            {error || 'Video not found'}
          </div>
          <Link href="/videos" className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to Videos
          </Link>
        </div>
      </div>
    )
  }

  const { video, summary, captions, quality_options, thumbnail_url } = watchData

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Player */}
            {watchUrl && video.status === 'ready' ? (
              <div className="bg-black rounded-lg overflow-hidden">
                <VideoPlayer
                  url={watchUrl}
                  type="application/vnd.apple.mpegurl"
                  hls={true}
                  qualityOptions={quality_options}
                  currentQuality={selectedQuality}
                  onQualityChange={handleQualityChange}
                />
              </div>
            ) : video.status === 'ready' ? (
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white">
                <div className="text-center">
                  <p className="mb-2">Video is ready but streaming URL is not available.</p>
                  <p className="text-sm text-gray-400">Please try again later.</p>
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Video is being processed... Status: {video.status}</p>
                  <p className="text-sm text-gray-400 mt-2">Please check back later.</p>
                </div>
              </div>
            )}

            {/* Video Title and Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {video.title}
              </h1>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>{video.user_name}</span>
                  <span>•</span>
                  <span>{formatDate(video.created_at)}</span>
                  {captions?.duration_seconds && (
                    <>
                      <span>•</span>
                      <span>{formatDuration(captions.duration_seconds)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  onClick={() => setShowSummary(!showSummary)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    showSummary
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {showSummary ? 'Hide' : 'Show'} AI Summary
                </button>
                {captions && (
                  <button
                    onClick={() => setShowCaptions(!showCaptions)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      showCaptions
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {showCaptions ? 'Hide' : 'Show'} Captions
                  </button>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {showSummary && summary?.summary_text && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Summary</h2>
                </div>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {summary.summary_text}
                </p>
                {summary.quality_score && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Quality Score: {summary.quality_score.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* Captions */}
            {showCaptions && captions?.transcript_text && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Captions</h2>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {captions.transcript_text}
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {video.description || 'No description available.'}
              </p>
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <CommentsSection videoId={videoId} />
            </div>
          </div>

          {/* Sidebar - Quality Options & Related */}
          <div className="space-y-4">
            {/* Quality Options */}
            {quality_options.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Quality Options</h3>
                <div className="space-y-2">
                  {quality_options.map((quality) => (
                    <button
                      key={quality.resolution}
                      onClick={() => handleQualityChange(quality.resolution)}
                      className={`w-full px-3 py-2 text-left rounded-md text-sm transition-colors ${
                        selectedQuality === quality.resolution
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{quality.resolution}</span>
                        {quality.size_bytes && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {(quality.size_bytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {quality.width} × {quality.height}
                        {quality.bitrate && ` • ${(quality.bitrate / 1000).toFixed(0)} kbps`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Video Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Video Information</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{video.status}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Uploaded by</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{video.user_name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Upload date</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{formatDate(video.created_at)}</dd>
                </div>
                {quality_options.length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Available qualities</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">{quality_options.length}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
