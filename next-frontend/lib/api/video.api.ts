/**
 * Video API endpoints
 */
import { apiClient } from './client'

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
  delete: async (id: number) => {
    const response = await apiClient.delete(`/videos/${id}`)
    return response.data
  },
}

