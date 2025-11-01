/**
 * OpenSearch index mapping for videos
 * Optimized for fuzzy search and filtering
 */
export const VIDEO_SEARCH_INDEX_MAPPING = {
  mappings: {
    properties: {
      video_id: {
        type: 'integer',
      },
      title: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
          },
          fuzzy: {
            type: 'text',
            analyzer: 'standard',
            // Enable fuzzy matching
          },
        },
      },
      description: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      user_id: {
        type: 'integer',
      },
      user_name: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      summary_text: {
        type: 'text',
        analyzer: 'standard',
        // For AI-generated summaries
      },
      transcript_snippet: {
        type: 'text',
        analyzer: 'standard',
        // First portion of transcript for search
      },
      created_at: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updated_at: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        standard: {
          type: 'standard',
        },
      },
    },
  },
};

