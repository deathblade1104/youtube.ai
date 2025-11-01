/**
 * Application-wide constants
 */

export const MIN_SEARCH_LENGTH = 3
export const MIN_EMAIL_CHECK_LENGTH = 3
export const DEBOUNCE_DELAY_SEARCH = 300
export const DEBOUNCE_DELAY_EMAIL = 500

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  COMMENTS_PER_PAGE: 20,
  VIDEOS_PER_PAGE: 10,
} as const

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: '/auth/signup',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
  },
  USERS: {
    ME: '/users/me',
    CHECK_EMAIL: '/users/check-email',
  },
  VIDEOS: {
    LIST: '/videos/list',
    SEARCH: '/videos/search',
    INFO: (id: number) => `/videos/${id}/info`,
    WATCH: (id: number) => `/videos/${id}/watch`,
    TRANSCRIPT: (id: number) => `/videos/${id}/transcript`,
    DETAILS: (id: number) => `/videos/${id}`,
    MY_PROCESSING: '/videos/my/processing',
  },
  UPLOAD: {
    INIT: '/upload/init',
    PRESIGNED_URL: '/upload/presigned-url',
    COMPLETE: '/upload/complete',
    SAVE: '/upload/save',
    ABORT: '/upload/abort',
    THUMBNAIL: '/upload/thumbnail',
  },
  SEARCH: {
    AUTOCOMPLETE: '/search/autocomplete',
  },
  COMMENTS: {
    LIST: (videoId: number) => `/videos/${videoId}/comments`,
    CREATE: (videoId: number) => `/videos/${videoId}/comments`,
    UPDATE: (videoId: number, commentId: number) => `/videos/${videoId}/comments/${commentId}`,
    LIKE: (videoId: number, commentId: number) => `/videos/${videoId}/comments/${commentId}/like`,
    DELETE: (videoId: number, commentId: number) => `/videos/${videoId}/comments/${commentId}`,
  },
} as const

export const ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
  },
  VIDEOS: {
    LIST: '/videos',
    UPLOAD: '/videos/upload',
    WATCH: (id: number) => `/videos/${id}`,
    PROCESSING: '/videos/processing',
  },
} as const

