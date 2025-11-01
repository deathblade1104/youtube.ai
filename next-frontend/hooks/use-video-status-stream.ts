import { useEffect, useRef, useState, useCallback } from 'react'

export interface VideoStatusUpdate {
  video_id: number
  status: string
  actor?: string
  status_message?: string | null
  timestamp: string
  processed_at?: string | null
}

export interface StatusLogEntry {
  status: string
  actor: string
  status_message: string | null
  timestamp: string
}

interface UseVideoStatusStreamOptions {
  videoId: number | null
  onStatusUpdate?: (update: VideoStatusUpdate) => void
  onClose?: (finalStatus: string) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

interface UseVideoStatusStreamReturn {
  status: string
  timeline: StatusLogEntry[]
  isConnected: boolean
  error: string | null
  reconnect: () => void
}

/**
 * Custom hook for connecting to video status SSE stream
 * Handles real-time status updates, timeline management, and connection lifecycle
 */
export function useVideoStatusStream(
  options: UseVideoStatusStreamOptions
): UseVideoStatusStreamReturn {
  const { videoId, onStatusUpdate, onClose, onError, enabled = true } = options

  const eventSourceRef = useRef<EventSource | null>(null)
  const [status, setStatus] = useState<string>('')
  const [timeline, setTimeline] = useState<StatusLogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addToTimeline = useCallback((update: VideoStatusUpdate) => {
    if (update.actor) {
      setTimeline((prev) => {
        const exists = prev.some(
          (entry) =>
            entry.timestamp === update.timestamp &&
            entry.status === update.status
        )
        if (exists) {
          return prev
        }
        return [
          ...prev,
          {
            status: update.status,
            actor: update.actor || 'system',
            status_message: update.status_message || null,
            timestamp: update.timestamp,
          },
        ].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      })
    }
  }, [])

  const connect = useCallback(() => {
    if (!videoId || !enabled) {
      return
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const token = localStorage.getItem('token')
    if (!token) {
      const err = new Error('Authentication token not found')
      setError(err.message)
      onError?.(err)
      return
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'
    const url = `${apiUrl}/videos/status/${videoId}/stream?token=${encodeURIComponent(token)}`

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource
      setIsConnected(true)
      setError(null)

      // Handle regular messages
      eventSource.onmessage = (event) => {
        try {
          const data: VideoStatusUpdate = JSON.parse(event.data)

          // Update current status
          setStatus(data.status)

          // Add to timeline if it has actor (status log entry)
          if (data.actor) {
            addToTimeline(data)
          }

          // Call callback
          onStatusUpdate?.(data)

          // Handle terminal states
          if (data.status === 'ready' || data.status === 'failed') {
            eventSource.close()
            eventSourceRef.current = null
            setIsConnected(false)
            onClose?.(data.status)
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err)
          const parseError = err instanceof Error ? err : new Error('Failed to parse SSE data')
          setError(parseError.message)
          onError?.(parseError)
        }
      }

      // Handle named events (close, error)
      eventSource.addEventListener('close', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          setStatus(data.status || status)
          eventSource.close()
          eventSourceRef.current = null
          setIsConnected(false)
          onClose?.(data.status || status)
        } catch (err) {
          console.error('Failed to parse close event:', err)
        }
      })

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          const errorMessage = data.message || 'Unknown error occurred'
          const err = new Error(errorMessage)
          setError(errorMessage)
          eventSource.close()
          eventSourceRef.current = null
          setIsConnected(false)
          onError?.(err)
        } catch (err) {
          // If parsing fails, it's a connection error
          console.error('SSE connection error:', err)
          const connectionError = new Error('SSE connection failed')
          setError(connectionError.message)
          eventSource.close()
          eventSourceRef.current = null
          setIsConnected(false)
          onError?.(connectionError)
        }
      })

      // Handle connection errors
      eventSource.onerror = (err) => {
        // This handles low-level connection errors
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('SSE connection closed:', err)
          setIsConnected(false)
          eventSourceRef.current = null
        }
      }
    } catch (err) {
      const connectionError = err instanceof Error
        ? err
        : new Error('Failed to create SSE connection')
      setError(connectionError.message)
      setIsConnected(false)
      onError?.(connectionError)
    }
  }, [videoId, enabled, onStatusUpdate, onClose, onError, addToTimeline, status])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    // Cleanup on unmount or when dependencies change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsConnected(false)
      }
    }
  }, [connect])

  return {
    status,
    timeline,
    isConnected,
    error,
    reconnect,
  }
}

