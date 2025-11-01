/**
 * Axios client configuration and interceptors
 */
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
        const url = error.config?.url || ''
        // Don't redirect on /users/me check - let the hook handle it gracefully
        // Only redirect on actual protected resource access
        if (!url.includes('/users/me')) {
          localStorage.removeItem('token')
          // Only redirect if we're not already on login/signup page
          const currentPath = window.location.pathname
          if (!currentPath.startsWith('/auth/')) {
            window.location.href = '/auth/login'
          }
        }
      }
    }
    return Promise.reject(error)
  }
)

