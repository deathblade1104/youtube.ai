/**
 * Comment API endpoints
 */
import { apiClient } from './client'

export interface CreateCommentData {
  content: string
  parent_id?: number | null
}

export interface UpdateCommentData {
  content: string
}

export const commentAPI = {
  list: async (videoId: number, page: number = 1, limit: number = 20) => {
    const response = await apiClient.get(`/videos/${videoId}/comments`, {
      params: { page, limit },
    })
    return response.data.data || response.data
  },
  create: async (videoId: number, data: CreateCommentData) => {
    const response = await apiClient.post(`/videos/${videoId}/comments`, data)
    return response.data.data || response.data
  },
  update: async (videoId: number, commentId: number, data: UpdateCommentData) => {
    const response = await apiClient.put(`/videos/${videoId}/comments/${commentId}`, data)
    return response.data.data || response.data
  },
  like: async (videoId: number, commentId: number) => {
    const response = await apiClient.post(`/videos/${videoId}/comments/${commentId}/like`)
    return response.data.data || response.data
  },
  delete: async (videoId: number, commentId: number) => {
    const response = await apiClient.delete(`/videos/${videoId}/comments/${commentId}`)
    return response.data
  },
}

