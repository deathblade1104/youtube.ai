'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchAPI } from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import { AutocompleteSuggestion } from '@/lib/types'
import { MIN_SEARCH_LENGTH, DEBOUNCE_DELAY_SEARCH } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

export function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_SEARCH)

  // Fetch autocomplete suggestions
  useEffect(() => {
    // Require at least 3 characters before searching
    if (debouncedQuery.trim().length >= MIN_SEARCH_LENGTH) {
      setIsSearching(true)
      searchAPI
        .autocomplete(debouncedQuery, 8)
        .then((data) => {
          setSuggestions(data.suggestions || [])
          setShowSuggestions(true)
        })
        .catch((err) => {
          console.error('Autocomplete error:', err)
          setSuggestions([])
        })
        .finally(() => {
          setIsSearching(false)
        })
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [debouncedQuery])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setShowSuggestions(false)
      router.push(`/videos?search=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleSuggestionClick = (videoId: number) => {
    setShowSuggestions(false)
    setQuery('')
    router.push(`/videos/${videoId}`)
  }

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl mx-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center shadow-lg shadow-blue-500/10 dark:shadow-blue-500/20 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all duration-300">
          {/* Search Icon */}
          <div className="absolute left-4 text-gray-400 dark:text-gray-500 pointer-events-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder="Search videos..."
            className="w-full px-4 py-3 pl-11 pr-12 bg-transparent border-0 rounded-l-full focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-24 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 hover:scale-110 active:scale-95 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            className={cn(
              'px-6 py-3 ml-2 rounded-r-full',
              'bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700',
              'hover:from-blue-700 hover:via-blue-700 hover:to-blue-800',
              'dark:from-blue-600 dark:via-blue-600 dark:to-blue-700',
              'dark:hover:from-blue-700 dark:hover:via-blue-700 dark:hover:to-blue-800',
              'text-white font-semibold transition-all duration-200',
              'shadow-md hover:shadow-lg hover:shadow-blue-500/30',
              'active:scale-[0.97] transform'
            )}
          >
            <span className="hidden sm:inline">Search</span>
            <svg className="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {showSuggestions && (query.trim().length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-3 bg-white/95 dark:bg-gray-800/95 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50 max-h-96 overflow-y-auto backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
          {isSearching && suggestions.length === 0 && (
            <div className="p-6 text-center">
              <div className="inline-flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Searching...</span>
              </div>
            </div>
          )}
          {!isSearching && suggestions.length === 0 && query.trim().length > 0 && (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No suggestions found</p>
            </div>
          )}
          {suggestions.length > 0 && (
            <ul className="py-2">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={`${suggestion.video_id}-${idx}`}
                  onClick={() => handleSuggestionClick(suggestion.video_id)}
                  className="px-4 py-3 mx-2 my-1 hover:bg-blue-50 dark:hover:bg-gray-700/50 cursor-pointer flex items-center space-x-3 transition-all duration-200 group rounded-xl active:scale-[0.98]"
                >
                  {suggestion.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={suggestion.thumbnail_url}
                      alt={suggestion.text}
                      className="w-20 h-11 object-cover rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-md"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-20 h-11 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {suggestion.text}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

