import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import { CheckEmailDto } from '../check-email.dto';
import { UserService } from '../user.service';

@Controller({ path: 'users', version: '1' })
@ApiTags('User API')
export class UsersController {
  constructor(private readonly service: UserService) {}

  @Get('info')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get current user information (alias for /users/info)',
    description:
      "Retrieve the authenticated user's profile information. This is an alias for /users/info.",
  })
  @ApiResponse({
    status: 200,
    description: 'User information retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getMe(@Req() req: CustomExpressRequest) {
    // Alias for getUserInfo - reuse the same logic
    return this.getUserInfo(req);
  }

  @Public()
  @Post('check-email')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Check if email exists',
    description:
      'Check if an email address is already registered in the system.',
  })
  @ApiBody({
    type: CheckEmailDto,
    description: 'Email address to check',
    examples: {
      example: {
        summary: 'Check Email Example',
        value: {
          email: 'john.doe@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Email existence check completed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email check completed' },
        data: {
          type: 'object',
          properties: {
            exists: {
              type: 'boolean',
              example: true,
              description: 'Whether the email exists in the system',
            },
            email: {
              type: 'string',
              example: 'john.doe@example.com',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['email must be an email'],
        },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  async checkEmail(@Body() dto: CheckEmailDto) {
    const exists = await this.service.checkUserEmailExists(dto.email);
    return {
      message: 'Email check completed',
      data: {
        exists,
        email: dto.email,
      },
    };
  }
}
