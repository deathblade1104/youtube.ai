import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { VideoSearchService } from '../services/search/video-search.service';

@Controller({ path: 'search', version: '1' })
@ApiTags('Search Controller')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchAutocompleteController {
  constructor(private readonly videoSearchService: VideoSearchService) {}

  @Get('autocomplete')
  @ApiOperation({
    summary: 'Get search autocomplete suggestions (like YouTube)',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Partial search query',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of suggestions (default: 10)',
  })
  async autocomplete(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const limitNum = limit ? parseInt(limit, 10) : 10;

    const suggestions = await this.videoSearchService.autocomplete(
      query,
      limitNum,
    );

    return {
      message: 'Autocomplete suggestions retrieved successfully',
      data: {
        query,
        suggestions: suggestions.map((s) => ({
          text: s.text,
          video_id: s.video_id,
          thumbnail_url: s.thumbnail_url,
        })),
      },
    };
  }
}
