'use client'

import { CommentsSection } from '@/components/comments-section'
import { Navbar } from '@/components/navbar'
import { VideoPlayer } from '@/components/video-player'
import { VideoInfoPanel } from '@/components/features/videos/video-info-panel'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Button, Card } from '@/components/ui'
import { videoAPI } from '@/lib/api'
import { VideoWatchData } from '@/lib/types'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { CardHeader, CardTitle, CardContent } from '@/components/ui'

export default function VideoWatchPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const videoId = Number(params.id);
  const [watchData, setWatchData] = useState<VideoWatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch watch data (includes video info, summary, captions, quality options)
        const data = await videoAPI.getWatchData(videoId);
        setWatchData(data);

        // Fetch watch URL (HLS manifest)
        if (data.video.status === 'ready') {
          try {
            const watchResponse = await videoAPI.getWatchUrl(videoId);
            if (watchResponse.url) {
              setWatchUrl(watchResponse.url);
            }
          } catch (err) {
            console.error('Error fetching watch URL:', err);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      fetchData();
    }
  }, [videoId]);

  const handleDeleteVideo = async () => {
    if (!videoId) return;
    try {
      setDeleting(true);
      await videoAPI.delete(videoId);
      router.push('/videos');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete video');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
    // In a real implementation, you'd switch the video quality here
    // For now, we'll just update the state
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <LoadingScreen message="Loading video..." />
      </>
    )
  }

  if (error || !watchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="p-8 text-center">
            <div className="mb-4">
              <svg className="w-20 h-20 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {error || 'Video not found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The video you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
            </p>
            <Link href="/videos">
              <Button variant="primary">← Back to Videos</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  const { video, summary, captions, quality_options, thumbnail_url } =
    watchData;

  // Check if current user is the owner
  const isOwner = user && watchData && watchData.uploader?.id === user.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            {watchUrl && video.status === 'ready' ? (
              <VideoPlayer
                url={watchUrl}
                type="application/vnd.apple.mpegurl"
                hls={true}
                qualityOptions={quality_options}
                currentQuality={selectedQuality}
                onQualityChange={handleQualityChange}
              />
            ) : video.status === 'ready' ? (
              <Card className="aspect-video flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                <div className="text-center p-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Video is ready but streaming URL is not available.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please try again later.
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="aspect-video flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
                <div className="text-center p-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/20 border-t-blue-600 mx-auto mb-4"></div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Video is being processed
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Status: <span className="font-medium capitalize">{video.status}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Please check back later
                  </p>
                </div>
              </Card>
            )}

            {/* Video Title and Info */}
            <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500'>
              <h1 className='text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent'>
                {video.title}
              </h1>
              <div className='flex items-center justify-between mb-6'>
                <div className='flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400'>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{video.user_name}</span>
                  <span className="text-gray-400">•</span>
                  <span>{formatDate(video.created_at)}</span>
                  {captions?.duration_seconds && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDuration(captions.duration_seconds)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className='flex items-center space-x-3 border-t border-gray-200/50 dark:border-gray-700/50 pt-4'>
                <button
                  onClick={() => setShowSummary(!showSummary)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                    showSummary
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {showSummary ? '✓ Hide' : 'Show'} AI Summary
                </button>
                {captions && (
                  <button
                    onClick={() => setShowCaptions(!showCaptions)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
                      showCaptions
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-green-500/30'
                        : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {showCaptions ? '✓ Hide' : 'Show'} Captions
                  </button>
                )}
                {isOwner && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleting}
                    className="ml-auto"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {showSummary && summary?.summary_text && (
              <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-blue-200/50 dark:border-blue-900/50 p-6 animate-in fade-in-0 slide-in-from-left-4 duration-500'>
                <div className='flex items-center space-x-3 mb-4'>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <svg
                      className='w-5 h-5 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                      AI Summary
                    </h2>
                    {summary.quality_score && (
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        Quality Score: <span className="font-semibold text-blue-600 dark:text-blue-400">{summary.quality_score.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-base'>
                  {summary.summary_text}
                </p>
              </div>
            )}

            {/* Captions */}
            {showCaptions && captions?.transcript_text && (
              <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-green-200/50 dark:border-green-900/50 p-6 animate-in fade-in-0 slide-in-from-left-4 duration-500'>
                <div className='flex items-center space-x-3 mb-4'>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                    <svg
                      className='w-5 h-5 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                      />
                    </svg>
                  </div>
                  <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                    Captions
                  </h2>
                </div>
                <div className='max-h-64 overflow-y-auto custom-scrollbar'>
                  <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm'>
                    {captions.transcript_text}
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500'>
              <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center space-x-2'>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span>Description</span>
              </h2>
              <p className='text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed'>
                {video.description || 'No description available.'}
              </p>
            </div>

            {/* Comments Section */}
            <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 animate-in fade-in-0 duration-500'>
              <CommentsSection videoId={videoId} />
            </div>
          </div>

          {/* Sidebar - Quality Options & Related */}
          <div className='space-y-4'>
            {/* Quality Options */}
            {quality_options.length > 0 && (
              <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-3'>
                  Quality Options
                </h3>
                <div className='space-y-2'>
                  {quality_options.map(quality => (
                    <button
                      key={quality.resolution}
                      onClick={() => handleQualityChange(quality.resolution)}
                      className={`w-full px-3 py-2 text-left rounded-md text-sm transition-colors ${
                        selectedQuality === quality.resolution
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <span className='font-medium'>
                          {quality.resolution}
                        </span>
                        {quality.size_bytes && (
                          <span className='text-xs text-gray-500 dark:text-gray-400'>
                            {(quality.size_bytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        )}
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {quality.width} × {quality.height}
                        {quality.bitrate &&
                          ` • ${(quality.bitrate / 1000).toFixed(0)} kbps`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Video Info Card */}
            <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-3'>
                Video Information
              </h3>
              <dl className='space-y-2 text-sm'>
                <div>
                  <dt className='text-gray-500 dark:text-gray-400'>Status</dt>
                  <dd className='text-gray-900 dark:text-white font-medium'>
                    {video.status}
                  </dd>
                </div>
                <div>
                  <dt className='text-gray-500 dark:text-gray-400'>
                    Uploaded by
                  </dt>
                  <dd className='text-gray-900 dark:text-white font-medium'>
                    {video.user_name}
                  </dd>
                </div>
                <div>
                  <dt className='text-gray-500 dark:text-gray-400'>
                    Upload date
                  </dt>
                  <dd className='text-gray-900 dark:text-white font-medium'>
                    {formatDate(video.created_at)}
                  </dd>
                </div>
                {quality_options.length > 0 && (
                  <div>
                    <dt className='text-gray-500 dark:text-gray-400'>
                      Available qualities
                    </dt>
                    <dd className='text-gray-900 dark:text-white font-medium'>
                      {quality_options.length}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Delete Video?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this video? This action cannot be undone. All video files, transcripts, summaries, and comments will be permanently deleted.
              </p>
              <div className="flex space-x-3">
                <Button
                  variant="danger"
                  onClick={handleDeleteVideo}
                  isLoading={deleting}
                  className="flex-1"
                >
                  Yes, Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
