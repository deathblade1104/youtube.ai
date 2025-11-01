'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { VideoGrid } from '@/components/features/videos/video-grid'
import { Button } from '@/components/ui/button'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { videoAPI } from '@/lib/api'
import { Video } from '@/lib/types'
import { PAGINATION } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

export default function VideosPage() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''

  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchVideos = async () => {
    try {
      setLoading(true)
      setError('')
      const response = searchQuery
        ? await videoAPI.search(searchQuery, page, PAGINATION.VIDEOS_PER_PAGE)
        : await videoAPI.list(page, PAGINATION.VIDEOS_PER_PAGE)

      const data = response.data || response
      if (Array.isArray(data)) {
        setVideos(data)
        setTotal(data.length)
      } else {
        setVideos(data.items || [])
        setTotal(data.total || 0)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load videos')
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery])

  const totalPages = Math.ceil(total / PAGINATION.VIDEOS_PER_PAGE)
  const hasMore = page < totalPages

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10 animate-in fade-in-0 slide-in-from-top-4 duration-500">
          {searchQuery ? (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-3">
                  Search Results
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Found <span className="font-semibold text-blue-600 dark:text-blue-400">{total}</span> video{total !== 1 ? 's' : ''} for &quot;<span className="font-medium text-gray-900 dark:text-white">{searchQuery}</span>&quot;
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-3">
                Explore Videos
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Discover amazing content from our community
              </p>
            </div>
          )}
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

        {/* Video Grid */}
        <div className="animate-in fade-in-0 duration-700">
          <VideoGrid videos={videos} loading={loading} />
        </div>

        {/* Pagination */}
        {!loading && videos.length > 0 && (
          <div className="mt-12 flex items-center justify-center gap-4 animate-in fade-in-0 duration-500">
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
            <div className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Page <span className="text-blue-600 dark:text-blue-400">{page}</span> of <span className="text-blue-600 dark:text-blue-400">{totalPages || 1}</span>
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-6 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            >
              Next
              <svg className="w-4 h-4 ml-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

