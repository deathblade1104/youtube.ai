'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { FileUploadArea } from '@/components/features/upload/file-upload-area'
import { ProgressBar } from '@/components/features/upload/progress-bar'
import { StatusTimeline } from '@/components/features/upload/status-timeline'
import { uploadAPI, videoAPI } from '@/lib/api'
import { formatFileSize } from '@/lib/utils/formatters'
import { useVideoStatusStream } from '@/hooks/use-video-status-stream'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

export default function UploadPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [uploadThumbnail, setUploadThumbnail] = useState(false)
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [uploadComplete, setUploadComplete] = useState(false)
  const [videoId, setVideoId] = useState<number | null>(null)
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)


  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setThumbnailFile(file)
      setUploadThumbnail(true)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeThumbnail = () => {
    setThumbnailFile(null)
    setThumbnailPreview(null)
    setUploadThumbnail(false)
    setThumbnailKey(null)
  }

  const uploadPart = async (presignedUrl: string, chunk: Blob, partNumber: number): Promise<string> => {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Type': file?.type || 'video/mp4',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to upload part ${partNumber}`)
    }
    return response.headers.get('ETag') || ''
  }

  // Use the improved SSE hook for video status streaming
  const {
    status: currentVideoStatus,
    timeline: statusTimeline,
    error: streamError,
  } = useVideoStatusStream({
    videoId,
    enabled: uploadComplete && videoId !== null,
    onStatusUpdate: (update) => {
      // Additional handling if needed
      console.debug('Status update received:', update)
    },
    onClose: (finalStatus) => {
      console.log('Stream closed with status:', finalStatus)
      if (finalStatus === 'ready') {
        setTimeout(() => {
          router.push('/videos')
        }, 2000)
      }
    },
    onError: (error) => {
      console.error('SSE stream error:', error)
    },
  })


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setProgress(0)
    setStatus('')
    setUploadComplete(false)
    setVideoId(null)

    if (!file) {
      setError('Please select a video file')
      return
    }

    setLoading(true)

    try {
      // Step 1: Initialize multipart upload
      setStatus('Initializing upload...')
      const initResponse = await uploadAPI.init({
        filename: file.name,
        content_type: file.type || 'video/mp4',
      })

      // Handle both wrapped and direct responses
      const initData = initResponse.data || initResponse
      const upload_id = initData.upload_id
      const key = initData.key

      if (!upload_id || !key) {
        throw new Error('Failed to initialize upload. Response: ' + JSON.stringify(initResponse))
      }

      // Store upload details for cancellation
      setUploadId(upload_id)
      setUploadKey(key)

      // Step 2: Split file into chunks and upload parts
      const chunks = Math.ceil(file.size / CHUNK_SIZE)
      const parts: Array<{ ETag: string; PartNumber: number }> = []

      setStatus(`Uploading ${chunks} parts...`)

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)
        const partNumber = i + 1

        // Get presigned URL for this part
        const presignedResponse = await uploadAPI.presignedUrl({
          key,
          upload_id,
          part_number: partNumber,
        })

        const presigned_url = presignedResponse.data?.presigned_url

        if (!presigned_url) {
          throw new Error('Failed to get presigned URL. Response: ' + JSON.stringify(presignedResponse))
        }

        // Upload part
        const etag = await uploadPart(presigned_url, chunk, partNumber)
        parts.push({ ETag: etag, PartNumber: partNumber })

        setProgress(Math.round(((i + 1) / chunks) * 80))
      }

      // Step 3: Complete multipart upload
      setStatus('Completing upload...')
      await uploadAPI.complete({
        key,
        upload_id,
        parts,
      })
      setProgress(90)

      // Step 4: Save video metadata first to get video ID
      setStatus('Saving video details...')
      const saveResponse = await uploadAPI.save({
        title,
        description,
        key,
      })

      // Get video ID from response
      const savedVideo = saveResponse.data || saveResponse
      const vidId = savedVideo.id || savedVideo.videoId

      if (!vidId) {
        throw new Error('Failed to get video ID from save response')
      }

      // Step 5: Upload thumbnail if provided
      let finalThumbnailKey = null
      if (uploadThumbnail && thumbnailFile) {
        try {
          setStatus('Uploading thumbnail...')
          const thumbnailResponse = await uploadAPI.uploadThumbnail({
            filename: thumbnailFile.name,
            content_type: thumbnailFile.type || 'image/jpeg',
            video_id: vidId,
          })

          const thumbnailData = thumbnailResponse.data || thumbnailResponse
          finalThumbnailKey = thumbnailData.key || thumbnailData.thumbnail_key
          setThumbnailKey(finalThumbnailKey)
        } catch (err: any) {
          console.error('Thumbnail upload error:', err)
          // Continue even if thumbnail fails
        }
      }

      setProgress(100)
      setStatus('Upload complete! Processing started...')

      if (vidId) {
        setVideoId(vidId)
        setUploadComplete(true)
        setLoading(false)
        // The SSE stream will automatically connect via the hook when videoId is set
      } else {
        throw new Error('Failed to get video ID from save response')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload failed. Please try again.')
      setStatus('')
      setLoading(false)
    }
  }

  const handleCancelUpload = async () => {
    if (!uploadId || !uploadKey || !videoId) {
      // Just reset state if no upload to abort
      setLoading(false)
      setUploadComplete(false)
      setVideoId(null)
      setUploadId(null)
      setUploadKey(null)
      return
    }

    try {
      // If video exists in DB, delete it (handles both in-progress and existing)
      if (videoId) {
        await videoAPI.delete(videoId)
      } else if (uploadId && uploadKey) {
        // If only upload metadata exists, abort multipart upload
        await uploadAPI.abort({ upload_id: uploadId, key: uploadKey })
      }

      // Reset state
      setLoading(false)
      setUploadComplete(false)
      setVideoId(null)
      setUploadId(null)
      setUploadKey(null)
      setProgress(0)
      setStatus('')
      setShowCancelConfirm(false)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel upload')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Upload Video
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Share your content with the world
          </p>
        </div>

        {(error || streamError) && (
          <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 dark:text-red-400 text-sm">{error || streamError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Upload Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Video Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Title"
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={uploadComplete}
                  placeholder="Enter video title"
                />

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    disabled={uploadComplete}
                    className="w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 resize-none"
                    placeholder="Describe your video..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Video File
                  </label>
                  <FileUploadArea
                    onFileSelect={(file) => setFile(file)}
                    accept="video/*"
                    disabled={uploadComplete}
                    selectedFile={file}
                    label="Drop video file here or click to browse"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Thumbnail <span className="text-gray-500 dark:text-gray-400 font-normal">(Optional)</span>
                  </label>
                  {thumbnailPreview ? (
                    <div className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full aspect-video object-cover rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                      <button
                        type="button"
                        onClick={removeThumbnail}
                        disabled={uploadComplete}
                        className="absolute top-3 right-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center space-x-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Remove</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <label
                        htmlFor="thumbnail"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-gray-500 transition-colors bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PNG, JPG up to 10MB (1280×720 recommended)
                          </p>
                        </div>
                        <input
                          id="thumbnail"
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          disabled={uploadComplete}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {status && !uploadComplete && (
                  <ProgressBar progress={progress} status={status} />
                )}

                {!uploadComplete && (
                  <Button
                    type="submit"
                    disabled={loading || !file}
                    isLoading={loading}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? 'Uploading...' : 'Upload Video'}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Status Timeline */}
          {uploadComplete && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Processing Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StatusTimeline entries={statusTimeline} currentStatus={currentVideoStatus} />
              </CardContent>
            </Card>
          )}

          {/* Upload Progress Sidebar (when uploading) */}
          {loading && !uploadComplete && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Upload Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {file && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <ProgressBar progress={progress} status={status} />
                  <Button
                    variant="danger"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full mt-4"
                    disabled={uploadComplete}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/videos/processing')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Processing Videos
          </Button>

          {uploadComplete && (
            <Button
              variant="primary"
              onClick={() => router.push(`/videos/${videoId}`)}
            >
              View Video
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader>
              <CardTitle>Cancel Upload?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to cancel this upload? All progress will be lost and any uploaded data will be deleted.
              </p>
              <div className="flex space-x-3">
                <Button
                  variant="danger"
                  onClick={handleCancelUpload}
                  className="flex-1"
                >
                  Yes, Cancel Upload
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1"
                >
                  No, Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
