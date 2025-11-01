import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import { Comment } from '../../../database/postgres/entities/comment.entity';
import { GenericCrudRepository } from '../../../database/postgres/repository/generic-crud.repository';
import { PaginationQueryDto } from '../../../common/dtos/pagination.dto';
import { CreateCommentDto, UpdateCommentDto } from '../dtos/comment.dto';
import { CommentService } from '../services/comments/comment.service';

@Controller({ path: 'videos/:videoId/comments', version: '1' })
@ApiTags('Comments Controller')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommentsController {
  private readonly commentRepository: GenericCrudRepository<Comment>;

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    private readonly commentService: CommentService,
  ) {
    this.commentRepository = new GenericCrudRepository(
      commentRepo,
      Comment.name,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get comments for a video (paginated)' })
  @ApiParam({ name: 'videoId', type: Number })
  async getComments(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Query() pagination: PaginationQueryDto,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = req.user ? parseInt(req.user.sub) : undefined;
    return await this.commentService.getComments(videoId, pagination, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a comment or reply' })
  @ApiParam({ name: 'videoId', type: Number })
  async createComment(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: CreateCommentDto,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = parseInt(req.user.sub);
    return await this.commentService.createComment(videoId, userId, dto);
  }

  @Put(':commentId')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiParam({ name: 'commentId', type: Number })
  async updateComment(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = parseInt(req.user.sub);
    return await this.commentService.updateComment(
      videoId,
      commentId,
      userId,
      dto,
    );
  }

  @Post(':commentId/like')
  @ApiOperation({ summary: 'Toggle like on a comment (like/unlike)' })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiParam({ name: 'commentId', type: Number })
  async toggleLikeComment(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = parseInt(req.user.sub);
    return await this.commentService.toggleLikeComment(videoId, commentId, userId);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiParam({ name: 'commentId', type: Number })
  async deleteComment(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: CustomExpressRequest,
  ) {
    const userId = parseInt(req.user.sub);
    return await this.commentService.deleteComment(
      videoId,
      commentId,
      userId,
    );
  }
}

