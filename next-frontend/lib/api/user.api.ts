/**
 * User API endpoints
 */
import { apiClient } from './client'

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

