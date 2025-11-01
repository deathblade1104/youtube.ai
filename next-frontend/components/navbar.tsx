'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DarkModeToggle } from './dark-mode-toggle'
import { SearchBar } from './search-bar'
import { ProfileMenu } from './profile-menu'

export function Navbar() {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/auth')

  if (isAuthPage) {
    return (
      <nav className="sticky top-0 z-50 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 group transition-all duration-300 hover:scale-105 active:scale-95">
              {/* Play icon */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:shadow-red-500/30 transition-all duration-300">
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {/* Logo text */}
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">youtube</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">.ai</span>
              </div>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo and Menu */}
          <div className="flex items-center space-x-6">
            <Link href="/videos" className="flex items-center space-x-2.5 flex-shrink-0 group transition-all duration-300 hover:scale-105 active:scale-95">
              {/* Play icon */}
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:shadow-red-500/30 transition-all duration-300 group-hover:rotate-12">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {/* Logo text */}
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">youtube</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">.ai</span>
              </div>
            </Link>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-2xl mx-4">
            <SearchBar />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Link
              href="/videos/upload"
              className="flex items-center space-x-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 dark:from-blue-700 dark:via-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:via-blue-800 dark:hover:to-blue-900 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.97]"
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
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">Upload</span>
            </Link>
            <DarkModeToggle />
            <ProfileMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}

