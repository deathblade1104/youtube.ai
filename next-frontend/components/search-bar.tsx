'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { searchAPI } from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import Link from 'next/link'

interface AutocompleteSuggestion {
  text: string
  video_id: number
  thumbnail_url: string | null
}

export function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
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
        <div className="relative flex items-center">
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
            className="w-full px-4 py-2 pl-10 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-l-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
          <div className="absolute left-3 pointer-events-none">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-full text-gray-700 dark:text-gray-300 transition-colors"
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {showSuggestions && (query.trim().length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {isSearching && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          )}
          {!isSearching && suggestions.length === 0 && query.trim().length > 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No suggestions found
            </div>
          )}
          {suggestions.length > 0 && (
            <ul className="py-2">
              {suggestions.map((suggestion, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion.video_id)}
                  className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-3 transition-colors"
                >
                  {suggestion.thumbnail_url ? (
                    <img
                      src={suggestion.thumbnail_url}
                      alt={suggestion.text}
                      className="w-16 h-9 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-9 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-gray-400"
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
                  <span className="text-sm text-gray-900 dark:text-white line-clamp-1 flex-1">
                    {suggestion.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

