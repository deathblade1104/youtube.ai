/**
 * Search API endpoints
 */
import { apiClient } from './client'

export const searchAPI = {
  autocomplete: async (query: string, limit: number = 10) => {
    const response = await apiClient.get('/search/autocomplete', {
      params: { q: query, limit },
    })
    return response.data.data || response.data
  },
}

