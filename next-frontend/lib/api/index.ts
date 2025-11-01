/**
 * Centralized API exports
 * All API modules are exported from here for convenience
 */
export { apiClient } from './client'
export * from './auth.api'
export * from './user.api'
export * from './video.api'

// Re-export other APIs for backward compatibility
export { uploadAPI } from './upload.api'
export { searchAPI } from './search.api'
export { commentAPI } from './comment.api'

