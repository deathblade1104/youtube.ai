import {
  Body,
  Controller,
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
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../common/interfaces/express-request.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { SignupDto } from './dtos/signup.dto';

@Controller({ path: 'auth', version: '1' })
@ApiTags('Authentication API')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  @ApiOperation({
    summary: 'User registration',
    description: 'Create a new user account with email and password.',
  })
  @ApiBody({
    type: SignupDto,
    description: 'User registration details',
    examples: {
      example: {
        summary: 'Registration Example',
        value: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'securePassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Signup Successfull' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            email: { type: 'string', example: 'john.doe@example.com' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email already in use' },
        error: { type: 'string', example: 'Conflict' },
        statusCode: { type: 'number', example: 409 },
      },
    },
  })
  async signup(@Body() dto: SignupDto) {
    const data = await this.authService.signup(dto);
    return {
      message: 'Signup Successfull',
      data,
    };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password to receive JWT token.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      example: {
        summary: 'Login Example',
        value: {
          email: 'john.doe@example.com',
          password: 'securePassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login Successfull' },
        data: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return {
      message: 'Login Successfull',
      data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout user by blacklisting their JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged out',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout Successfull' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
        statusCode: { type: 'number', example: 401 },
      },
    },
  })
  async logout(@Req() req: CustomExpressRequest) {
    const token = req.headers.authorization?.split(' ')[1];
    await this.authService.logout(token, req.user);
    return {
      message: 'Logout Successfull',
    };
  }
}
