/**
 * Authentication API endpoints
 */
import { apiClient } from './client'

export interface SignupData {
  email: string
  password: string
  name: string
}

export interface LoginData {
  email: string
  password: string
}

export const authAPI = {
  signup: async (data: SignupData) => {
    const response = await apiClient.post('/auth/signup', data)
    return response.data
  },
  login: async (data: LoginData) => {
    const response = await apiClient.post('/auth/login', data)
    return response.data
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout')
    return response.data
  },
}

