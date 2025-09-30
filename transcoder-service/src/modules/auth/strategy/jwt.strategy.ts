import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CONFIG } from '../../../common/enums/config.enums';
import { IAuthConfig } from '../../../configs/auth.config';
import { AuthService } from '../auth.service';
import {
  IJwtPayload,
  ParsedTokenData,
} from '../interface/jwtpayload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const authConfig = configService.getOrThrow<IAuthConfig>(CONFIG.AUTH);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: authConfig.jwtSecret,
      ignoreExpiration: false,
      passReqToCallback: true, // so validate(req, payload) works
    });
  }

  async validate(req: Request, payload: IJwtPayload): Promise<ParsedTokenData> {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token missing');

    const isBlacklisted = await this.authService.isBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      exp: (payload as any).exp,
      iat: (payload as any).iat,
      iss: (payload as any).iss,
      jti: (payload as any).jti || token, // fallback to raw token
    };
  }
}
