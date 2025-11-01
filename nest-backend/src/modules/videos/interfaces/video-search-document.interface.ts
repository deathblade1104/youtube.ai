/**
 * Video document structure in OpenSearch
 * Optimized for search with only relevant fields
 */
export interface IVideoSearchDocument {
  video_id: number; // Primary identifier, linked to DB
  title: string; // Searchable title
  description: string; // Searchable description
  user_id: number; // Filterable user ID
  user_name: string; // Searchable user name
  summary_text?: string; // Searchable summary (from AI)
  transcript_snippet?: string; // First 500 chars of transcript for search
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

