'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken, setAuthToken, removeAuthToken } from '@/lib/auth'
import { userAPI } from '@/lib/api'

interface User {
  id: number
  email: string
  name: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      // Optionally fetch user data
      userAPI
        .getMe()
        .then((data) => {
          if (data?.data) {
            setUser(data.data)
          }
        })
        .catch(() => {
          // Token might be invalid
          removeAuthToken()
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (token: string) => {
    setAuthToken(token)
    userAPI
      .getMe()
      .then((data) => {
        if (data?.data) {
          setUser(data.data)
        }
      })
      .catch(console.error)
  }

  const logout = () => {
    removeAuthToken()
    setUser(null)
    router.push('/auth/login')
  }

  const isAuthenticated = !!getAuthToken()

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
  }
}

