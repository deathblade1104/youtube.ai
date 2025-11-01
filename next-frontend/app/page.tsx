'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      router.push('/videos')
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return null
}

