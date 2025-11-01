'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
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
  const [deletingVideoId, setDeletingVideoId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [expandedVideos, setExpandedVideos] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const VIDEOS_PER_PAGE = 10

  useEffect(() => {
    loadVideos()
    setPage(1) // Reset to first page when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompleted, statusFilter])

  useEffect(() => {
    loadVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const response = await videoAPI.getMyProcessing(showCompleted)
      let filteredVideos = response.videos || []

      // Apply status filter
      if (statusFilter !== 'all') {
        filteredVideos = filteredVideos.filter(v => v.status === statusFilter)
      }

      // Apply pagination
      const total = filteredVideos.length
      setTotal(total)
      const startIndex = (page - 1) * VIDEOS_PER_PAGE
      const endIndex = startIndex + VIDEOS_PER_PAGE
      filteredVideos = filteredVideos.slice(startIndex, endIndex)

      setVideos(filteredVideos)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (videoId: number) => {
    const newExpanded = new Set(expandedVideos)
    if (newExpanded.has(videoId)) {
      newExpanded.delete(videoId)
    } else {
      newExpanded.add(videoId)
    }
    setExpandedVideos(newExpanded)
  }

  const getLatestStatus = (video: VideoWithHistory) => {
    if (!video.status_history || video.status_history.length === 0) {
      return null
    }
    const sorted = [...video.status_history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    return sorted[0]
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

  const handleDeleteVideo = async (videoId: number) => {
    try {
      setDeletingVideoId(videoId)
      await videoAPI.delete(videoId)
      // Reload videos list
      await loadVideos()
      setShowDeleteConfirm(null)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete video')
    } finally {
      setDeletingVideoId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your videos...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10 animate-in fade-in-0 slide-in-from-top-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-2">
                My Processing Videos
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Track the status of your video uploads
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-sm font-medium text-gray-900 dark:text-white shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="uploading">Uploading</option>
                <option value="transcoding">Transcoding</option>
                <option value="transcribing">Transcribing</option>
                <option value="summarizing">Summarizing</option>
                <option value="indexing">Indexing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>

              {/* Toggle Switch */}
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-all duration-200 ${
                    showCompleted
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      showCompleted ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`}></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  Include completed videos
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-5 bg-red-50/80 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-xl text-red-700 dark:text-red-400 shadow-lg backdrop-blur-sm animate-in slide-in-from-left-4 duration-300">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {videos.length === 0 ? (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-12 text-center animate-in fade-in-0 duration-500">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No {showCompleted ? '' : 'in-progress or failed '}videos found
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {showCompleted ? 'Upload your first video to get started!' : 'All your videos have completed processing.'}
            </p>
          </div>
        ) : (
          <>
            {/* Video Count */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {videos.length} of {total} video{total !== 1 ? 's' : ''}
            </div>

            <div className="space-y-3 animate-in fade-in-0 duration-700">
              {videos.map((video, index) => {
                const isExpanded = expandedVideos.has(video.id)
                const latestStatus = getLatestStatus(video)
                const hasHistory = video.status_history && video.status_history.length > 0

                return (
                  <div
                    key={video.id}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {video.title}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ${getStatusColor(video.status)}`}>
                              {getStatusLabel(video.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
                            {video.description || 'No description available'}
                          </p>
                          {latestStatus && !isExpanded && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(latestStatus.status)}`}></div>
                              <span>Last: {getStatusLabel(latestStatus.status)}</span>
                              <span>•</span>
                              <span>{new Date(latestStatus.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                            {new Date(video.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {video.status_message && (
                        <div className="mt-3 p-3 bg-yellow-50/80 dark:bg-yellow-900/20 border-l-4 border-yellow-500 dark:border-yellow-400 rounded-lg shadow-sm backdrop-blur-sm">
                          <div className="flex items-start space-x-2">
                            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 line-clamp-2">
                              {video.status_message}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Expandable Timeline */}
                      {hasHistory && (
                        <div className="mt-4">
                          <button
                            onClick={() => toggleExpand(video.id)}
                            className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-3"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span>Status Timeline ({video.status_history?.length || 0})</span>
                          </button>

                          {isExpanded && (
                            <div className="relative pl-8 animate-in fade-in-0 duration-300">
                              {/* Timeline line */}
                              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                              {/* Timeline items */}
                              <div className="space-y-3">
                                {video.status_history
                                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                                  .map((entry, idx) => (
                                    <div key={idx} className="relative flex items-start space-x-3">
                                      <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${getStatusColor(entry.status)}`}>
                                        <div className="w-2 h-2 rounded-full bg-current"></div>
                                      </div>
                                      <div className="flex-1 min-w-0 pb-3">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                                            {getStatusLabel(entry.status)}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                                            {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        </div>
                                        {entry.status_message && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 line-clamp-2">
                                            {entry.status_message}
                                          </p>
                                        )}
                                        <p className="text-xs text-gray-500 dark:text-gray-500">
                                          by {entry.actor}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <button
                            onClick={() => router.push(`/videos/${video.id}`)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                          >
                            View
                          </button>
                          {video.status === 'ready' && (
                            <button
                              onClick={() => router.push(`/videos/${video.id}`)}
                              className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              Watch
                            </button>
                          )}
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(video.id)}
                          isLoading={deletingVideoId === video.id}
                          disabled={deletingVideoId !== null}
                          className="shadow-sm hover:shadow-md transition-all duration-200 text-xs px-3 py-1.5"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {Math.ceil(total / VIDEOS_PER_PAGE) > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </Button>
                <div className="flex items-center gap-2 px-6 py-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Page <span className="text-blue-600 dark:text-blue-400">{page}</span> of <span className="text-blue-600 dark:text-blue-400">{Math.ceil(total / VIDEOS_PER_PAGE) || 1}</span>
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / VIDEOS_PER_PAGE)}
                  className="px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                >
                  Next
                  <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in-0 duration-200">
            <Card className="max-w-md w-full mx-4 p-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 animate-in zoom-in-95 duration-300">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Delete Video?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  Are you sure you want to delete this video? This action cannot be undone. All video files, transcripts, summaries, and comments will be permanently deleted.
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="danger"
                    onClick={() => handleDeleteVideo(showDeleteConfirm)}
                    isLoading={deletingVideoId === showDeleteConfirm}
                    className="flex-1 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Yes, Delete
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
                    disabled={deletingVideoId !== null}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

