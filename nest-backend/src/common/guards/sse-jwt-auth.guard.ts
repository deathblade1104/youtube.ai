import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CONFIG } from '../enums/config.enums';
import { IAuthConfig } from '../../configs/auth.config';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Custom guard for SSE endpoints that authenticates via query parameter token
 * Since EventSource doesn't support custom headers, we use query params
 */
@Injectable()
export class SseJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.query?.token;

    if (!token) {
      throw new UnauthorizedException('Token required');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.authService.isBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    // Verify and decode token
    try {
      const authConfig = this.configService.getOrThrow<IAuthConfig>(
        CONFIG.AUTH,
      );
      const decoded = this.jwtService.verify(token, {
        secret: authConfig.jwtSecret,
      });

      // Attach user info to request (similar to JwtAuthGuard)
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

