'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { uploadAPI, videoAPI } from '@/lib/api'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

interface StatusUpdate {
  video_id: number
  status: string
  actor?: string
  status_message?: string | null
  timestamp: string
  processed_at?: string | null
}

interface StatusLogEntry {
  status: string
  actor: string
  status_message: string | null
  timestamp: string
}

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
  const [statusTimeline, setStatusTimeline] = useState<StatusLogEntry[]>([])
  const [currentVideoStatus, setCurrentVideoStatus] = useState<string>('')
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

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

  // Connect to SSE stream for video status
  const connectStatusStream = (vidId: number) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const token = localStorage.getItem('token')
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/videos/status/${vidId}/stream?token=${encodeURIComponent(token || '')}`

    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      try {
        const data: StatusUpdate = JSON.parse(event.data)
        setCurrentVideoStatus(data.status)

        // Add to timeline if it's a status log entry
        if (data.actor) {
          setStatusTimeline((prev) => {
            const exists = prev.some(
              (entry) => entry.timestamp === data.timestamp && entry.status === data.status
            )
            if (!exists) {
              return [
                ...prev,
                {
                  status: data.status,
                  actor: data.actor || 'system',
                  status_message: data.status_message || null,
                  timestamp: data.timestamp,
                },
              ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            }
            return prev
          })
        }

        // Close connection if terminal state
        if (data.status === 'ready' || data.status === 'failed') {
          eventSource.close()
          eventSourceRef.current = null
          if (data.status === 'ready') {
            setTimeout(() => {
              router.push('/videos')
            }, 2000)
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err)
      // Close on error
      eventSource.close()
      eventSourceRef.current = null
    }

    eventSourceRef.current = eventSource
  }

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setProgress(0)
    setStatus('')
    setUploadComplete(false)
    setVideoId(null)
    setStatusTimeline([])
    setCurrentVideoStatus('')

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

        // Connect to SSE stream for status updates
        connectStatusStream(vidId)
      } else {
        throw new Error('Failed to get video ID from save response')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Upload failed. Please try again.')
      setStatus('')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Upload Video</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={uploadComplete}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    disabled={uploadComplete}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Video File
                  </label>
                  <input
                    id="file"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    required
                    disabled={uploadComplete}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {file && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Thumbnail (Optional)
                  </label>
                  {thumbnailPreview ? (
                    <div className="relative">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full aspect-video object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={removeThumbnail}
                        disabled={uploadComplete}
                        className="absolute top-2 right-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        id="thumbnail"
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                        disabled={uploadComplete}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Recommended: 1280×720 (16:9 aspect ratio)
                      </p>
                    </div>
                  )}
                </div>

                {status && !uploadComplete && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{status}</p>
                    {progress > 0 && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {!uploadComplete && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
                  >
                    {loading ? 'Uploading...' : 'Upload Video'}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Status Timeline */}
          {uploadComplete && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Processing Status
              </h2>
              {currentVideoStatus && (
                <div className="mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentVideoStatus)}`}>
                    {getStatusLabel(currentVideoStatus)}
                  </span>
                </div>
              )}
              <div className="space-y-4">
                {statusTimeline.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Waiting for status updates...</p>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                    {/* Timeline items */}
                    <div className="space-y-4">
                      {statusTimeline.map((entry, index) => (
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
                                {new Date(entry.timestamp).toLocaleTimeString()}
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* View Processing Videos Link */}
        <div className="mt-6">
          <button
            onClick={() => router.push('/videos/processing')}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            View my in-progress and failed uploads →
          </button>
        </div>
      </div>
    </div>
  )
}
