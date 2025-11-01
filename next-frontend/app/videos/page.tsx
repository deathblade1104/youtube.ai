'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import { videoAPI } from '@/lib/api'

interface Video {
  id: number
  title: string
  description: string
  status: string
  user_name: string
  created_at: string
  thumbnail_url?: string | null
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError('')
      const response = searchQuery
        ? await videoAPI.search(searchQuery, page, 10)
        : await videoAPI.list(page, 10)

      const data = response.data || response
      setVideos(Array.isArray(data) ? data : data.items || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchVideos()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ready: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      processing: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    }
    return colors[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {searchQuery && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Search results for "{searchQuery}"
            </h2>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setPage(1)
                fetchVideos()
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">Loading videos...</div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            No videos found. <Link href="/videos/upload" className="text-blue-600 dark:text-blue-400 hover:underline">Upload one?</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="group bg-white dark:bg-gray-800 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                {/* Thumbnail Image */}
                <div className="aspect-video w-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800">
                      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Status Badge Overlay */}
                  <div className="absolute bottom-2 right-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium backdrop-blur-sm ${getStatusColor(video.status)}`}>
                      {video.status}
                    </span>
                  </div>
                </div>
                {/* Video Info */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {video.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{video.user_name || 'Unknown'}</span>
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-md transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={videos.length < 10}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 rounded-md transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

