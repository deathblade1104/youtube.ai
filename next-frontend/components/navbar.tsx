'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DarkModeToggle } from './dark-mode-toggle'
import { SearchBar } from './search-bar'
import { removeAuthToken } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = pathname?.startsWith('/auth')

  const handleLogout = () => {
    removeAuthToken()
    router.push('/auth/login')
  }

  if (isAuthPage) {
    return (
      <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold text-red-600 dark:text-red-500">YouTube</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">AI</span>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo and Menu */}
          <div className="flex items-center space-x-6">
            <Link href="/videos" className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-xl font-bold text-red-600 dark:text-red-500">YouTube</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">AI</span>
            </Link>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-2xl mx-4">
            <SearchBar />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <Link
              href="/videos/upload"
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">Upload</span>
            </Link>
            <DarkModeToggle />
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <span className="hidden sm:inline">Logout</span>
              <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

