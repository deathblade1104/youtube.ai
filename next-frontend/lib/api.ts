import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  signup: async (data: { email: string; password: string; name: string }) => {
    const response = await apiClient.post('/auth/signup', data)
    return response.data
  },
  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout')
    return response.data
  },
}

// User API
export const userAPI = {
  getMe: async () => {
    const response = await apiClient.get('/users/me')
    return response.data
  },
  checkEmail: async (email: string) => {
    const response = await apiClient.post('/users/check-email', { email })
    return response.data
  },
}

// Upload API
export const uploadAPI = {
  init: async (data: { filename: string; content_type: string; has_custom_thumbnail?: boolean }) => {
    const response = await apiClient.post('/upload/init', data)
    return response.data
  },
  presignedUrl: async (data: { key: string; upload_id: string; part_number: number }) => {
    const response = await apiClient.post('/upload/presigned-url', data)
    return response.data
  },
  complete: async (data: { key: string; upload_id: string; parts: Array<{ ETag: string; PartNumber: number }> }) => {
    const response = await apiClient.post('/upload/complete', data)
    return response.data
  },
  save: async (data: { title: string; description: string; key: string; thumbnail_key?: string }) => {
    const response = await apiClient.post('/upload/save', data)
    return response.data
  },
  abort: async (data: { upload_id: string; key: string }) => {
    const response = await apiClient.post('/upload/abort', data)
    return response.data
  },
  uploadThumbnail: async (data: { filename: string; content_type: string; video_id: number }) => {
    const response = await apiClient.post('/upload/thumbnail', data)
    return response.data
  },
}

// Video API
export const videoAPI = {
  list: async (page: number = 1, limit: number = 10) => {
    const response = await apiClient.get('/videos/list', {
      params: { page, limit },
    })
    return response.data
  },
  search: async (query: string, page: number = 1, limit: number = 10) => {
    const response = await apiClient.get('/videos/search', {
      params: { q: query, page, limit },
    })
    return response.data
  },
  getById: async (id: number) => {
    const response = await apiClient.get(`/videos/${id}`)
    return response.data.data || response.data
  },
  getWatchData: async (id: number) => {
    const response = await apiClient.get(`/videos/${id}`)
    return response.data.data || response.data
  },
  getInfo: async (id: number) => {
    const response = await apiClient.get(`/videos/${id}/info`)
    return response.data.data || response.data
  },
  getWatchUrl: async (id: number) => {
    const response = await apiClient.get(`/videos/${id}/watch`)
    return response.data.data || response.data
  },
  getTranscript: async (id: number) => {
    const response = await apiClient.get(`/videos/${id}/transcript`)
    return response.data.data || response.data
  },
  getMyProcessing: async (includeCompleted?: boolean) => {
    const response = await apiClient.get('/videos/my/processing', {
      params: { include_completed: includeCompleted },
    })
    return response.data.data || { videos: [], total: 0 }
  },
}

// Search API
export const searchAPI = {
  autocomplete: async (query: string, limit: number = 10) => {
    const response = await apiClient.get('/search/autocomplete', {
      params: { q: query, limit },
    })
    return response.data.data || response.data
  },
}

// Comment API
export const commentAPI = {
  list: async (videoId: number, page: number = 1, limit: number = 20) => {
    const response = await apiClient.get(`/videos/${videoId}/comments`, {
      params: { page, limit },
    })
    return response.data.data || response.data
  },
  create: async (videoId: number, data: { content: string; parent_id?: number | null }) => {
    const response = await apiClient.post(`/videos/${videoId}/comments`, data)
    return response.data.data || response.data
  },
  update: async (videoId: number, commentId: number, data: { content: string }) => {
    const response = await apiClient.put(`/videos/${videoId}/comments/${commentId}`, data)
    return response.data.data || response.data
  },
  like: async (videoId: number, commentId: number) => {
    const response = await apiClient.post(`/videos/${videoId}/comments/${commentId}/like`)
    // Response structure from interceptor: { success, path, status_code, message, data: { comment_id, likes, has_liked } }
    return response.data.data || response.data
  },
  delete: async (videoId: number, commentId: number) => {
    const response = await apiClient.delete(`/videos/${videoId}/comments/${commentId}`)
    return response.data
  },
}

