import { Controller, Get, HttpCode, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../common/interfaces/express-request.interface';
import { UserService } from './user.service';

@Controller({ path: 'users', version: '1' })
@ApiTags('User API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly service: UserService) {}

  @Get('info')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get current user information',
    description:
      "Retrieve the authenticated user's profile information including name, email, and account details.",
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'User Info fetched successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@example.com' },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async getUserInfo(@Req() req: CustomExpressRequest) {
    const userId = req.user.sub;
    const data = await this.service.getUserInfoById(parseInt(userId));
    return {
      message: 'User Info fetched successfully',
      data,
    };
  }
}
