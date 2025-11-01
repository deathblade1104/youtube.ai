'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { videoAPI } from '@/lib/api'

interface StatusLogEntry {
  status: string
  actor: string
  status_message: string | null
  timestamp: string
}

interface VideoWithHistory {
  id: number
  title: string
  description: string
  status: string
  status_message: string | null
  created_at: string
  processed_at: string | null
  status_history: StatusLogEntry[]
}

export default function ProcessingVideosPage() {
  const router = useRouter()
  const [videos, setVideos] = useState<VideoWithHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    loadVideos()
  }, [showCompleted])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const response = await videoAPI.getMyProcessing(showCompleted)
      setVideos(response.videos || [])
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      uploading: 'Uploading',
      transcoding: 'Transcoding',
      transcribing: 'Transcribing',
      summarizing: 'Summarizing',
      indexing: 'Indexing',
      ready: 'Ready',
      failed: 'Failed',
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      uploading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      transcoding: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      transcribing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      summarizing: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      indexing: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Processing Videos
          </h1>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Include completed videos
            </span>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {videos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No {showCompleted ? '' : 'in-progress or failed '}videos found.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {video.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {video.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                      {getStatusLabel(video.status)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {new Date(video.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {video.status_message && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      {video.status_message}
                    </p>
                  </div>
                )}

                {video.status_history && video.status_history.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Status Timeline
                    </h4>
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                      {/* Timeline items */}
                      <div className="space-y-3">
                        {video.status_history
                          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                          .map((entry, index) => (
                            <div key={index} className="relative flex items-start space-x-4">
                              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(entry.status)}`}>
                                <div className="w-3 h-3 rounded-full bg-current"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {getStatusLabel(entry.status)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(entry.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                {entry.status_message && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                    {entry.status_message}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  by {entry.actor}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => router.push(`/videos/${video.id}`)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Details
                  </button>
                  {video.status === 'ready' && (
                    <button
                      onClick={() => router.push(`/videos/${video.id}`)}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                      Watch Video
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

