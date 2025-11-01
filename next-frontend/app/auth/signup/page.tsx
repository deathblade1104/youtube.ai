'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authAPI, userAPI } from '@/lib/api'
import { setAuthToken } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { useDebounce } from '@/hooks/use-debounce'
import { EMAIL_REGEX, MIN_EMAIL_CHECK_LENGTH, DEBOUNCE_DELAY_EMAIL } from '@/lib/constants'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)

  const debouncedEmail = useDebounce(email, DEBOUNCE_DELAY_EMAIL)

  // Check email availability when debounced email changes
  useEffect(() => {
    const checkEmailAvailability = async () => {
      if (!debouncedEmail) {
        setEmailError('')
        return
      }

      // Require at least 3 characters before checking
      if (debouncedEmail.trim().length < MIN_EMAIL_CHECK_LENGTH) {
        setEmailError('')
        return
      }

      if (!EMAIL_REGEX.test(debouncedEmail)) {
        setEmailError('Please enter a valid email address')
        return
      }

      setCheckingEmail(true)
      setEmailError('')

      try {
        const response = await userAPI.checkEmail(debouncedEmail)
        const exists = response.data?.exists || false

        if (exists) {
          setEmailError('This email is already registered')
        } else {
          setEmailError('')
        }
      } catch (err: any) {
        // Silently fail - don't block signup if check fails
        console.error('Email check failed:', err)
      } finally {
        setCheckingEmail(false)
      }
    }

    checkEmailAvailability()
  }, [debouncedEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authAPI.signup({ name, email, password })
      // After signup, automatically log in
      const loginResponse = await authAPI.login({ email, password })
      setAuthToken(loginResponse.data.access_token)
      router.push('/videos')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl"></div>
      </div>

      <Navbar />
      <div className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-56px)] relative z-10">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-500">
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create Account
            </CardTitle>
            <p className="text-base text-gray-600 dark:text-gray-400 mt-3">
              Join our community and start sharing your videos
            </p>
          </CardHeader>
          <CardContent>

            {error && (
              <div className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 rounded-lg text-red-700 dark:text-red-400 text-sm shadow-md backdrop-blur-sm animate-in slide-in-from-left-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Name"
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500/50"
              />

              <div className="relative">
                <Input
                  label="Email"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  error={emailError}
                  placeholder="Enter your email"
                  className={`transition-all duration-200 focus:ring-2 focus:ring-blue-500/50 ${checkingEmail ? 'pr-10' : ''}`}
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-[38px]">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              <div className="relative">
                <Input
                  label="Password"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none transition-all duration-200 hover:scale-110"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m13.42 13.42l-3.29-3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={loading || !!emailError || checkingEmail}
                isLoading={loading}
              >
                Create Account
              </Button>
            </form>

            <p className="mt-8 text-sm text-center text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

