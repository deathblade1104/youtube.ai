import { Injectable, Logger } from '@nestjs/common';
import {
  PaginatedResponseDto,
  Direction as PaginationDirection,
  PaginationDto,
} from '../../../../common/dtos/opensearch-pagination.dto';
import { OPENSEARCH_QUERY_TYPES } from '../../../../database/opensearch/opensearch.constants';
import { Direction } from '../../../../database/opensearch/opensearch.interface';
import { OpensearchService } from '../../../../database/opensearch/opensearch.service';
import { VIDEO_SEARCH_INDEX } from '../../constants/search.constants';
import { IVideoSearchDocument } from '../../interfaces/video-search-document.interface';

@Injectable()
export class VideoSearchService {
  private readonly logger = new Logger(VideoSearchService.name);

  constructor(private readonly opensearchService: OpensearchService) {}

  /**
   * Search videos in OpenSearch with fuzzy matching
   */
  async searchVideos(
    query: string,
    pagination: PaginationDto,
  ): Promise<
    PaginatedResponseDto & {
      data: Array<IVideoSearchDocument & { _id: string }>;
    }
  > {
    try {
      const {
        direction = PaginationDirection.NEXT,
        cursor,
        size = 10,
      } = pagination;

      // Map pagination direction to OpenSearch direction
      const osDirection =
        direction === PaginationDirection.NEXT
          ? Direction.NEXT
          : Direction.PREV;

      // Build search query with fuzzy matching
      const searchQuery = this.opensearchService.queryBuilder({
        multiMatch: [
          {
            query,
            fields: [
              'title^3', // Boost title matches
              'description^2', // Boost description matches
              'summary_text',
              'transcript_snippet',
              'user_name',
            ],
            type: OPENSEARCH_QUERY_TYPES.bestFields,
            fuzziness: 'AUTO', // Enable fuzzy search
          },
        ],
      });

      const result = await this.opensearchService.fetchDocs<
        IVideoSearchDocument & { _id: string }
      >({
        searchIndex: VIDEO_SEARCH_INDEX,
        query: searchQuery,
        size,
        searchAfter: cursor,
        direction: osDirection,
        sort: [{ created_at: 'desc' }],
      });

      // Extract last item's ID for next cursor, first item's ID for prev cursor
      const data = result.data || [];
      const lastItem = data.length > 0 ? data[data.length - 1] : null;
      const firstItem = data.length > 0 ? data[0] : null;

      const nextCursor = lastItem?._id || null;
      const prevCursor = firstItem?._id || null;

      return {
        data,
        pagination: {
          next_cursor: nextCursor || '',
          prev_cursor: prevCursor || '',
          size: data.length,
          total: result.total || 0,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to search videos: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Autocomplete suggestions based on video titles and descriptions
   */
  async autocomplete(
    query: string,
    limit: number = 10,
  ): Promise<
    Array<{
      text: string;
      video_id: number;
      thumbnail_url: string | null;
    }>
  > {
    try {
      // Build autocomplete query with prefix matching
      const searchQuery = this.opensearchService.queryBuilder({
        multiMatch: [
          {
            query,
            fields: ['title^3', 'description^2'],
            type: OPENSEARCH_QUERY_TYPES.bestFields,
            fuzziness: 'AUTO',
          },
        ],
      });

      const result = await this.opensearchService.fetchDocs<
        IVideoSearchDocument & { _id: string }
      >({
        searchIndex: VIDEO_SEARCH_INDEX,
        query: searchQuery,
        size: limit,
        sort: [{ created_at: 'desc' }],
      });

      // Return simplified suggestions with titles
      return result.data.map((doc) => ({
        text: doc.title,
        video_id: doc.video_id,
        thumbnail_url: null, // Will be enhanced by controller if needed
      }));
    } catch (error: any) {
      this.logger.error(
        `Failed to get autocomplete suggestions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
