import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CacheService } from '../../database/redis/redis.service';
import { UserService } from '../user/user.service';
import { LoginResponseDto, SignUpResponseDto } from './dtos/auth-response.dto';
import { LoginDto } from './dtos/login.dto';
import { SignupDto } from './dtos/signup.dto';
import { IJwtPayload, ParsedTokenData } from './interface/jwtpayload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
    private readonly userService: UserService,
  ) {}

  async signup(dto: SignupDto): Promise<SignUpResponseDto> {
    const existing = await this.userService.getUserByEmail(dto.email);

    if (existing) throw new ConflictException('Email already in use');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(dto.password, salt);

    const user = await this.userService.createUser({
      name: dto.name,
      email: dto.email,
      password_hash,
    });

    return { id: user.id, email: user.email };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userService.getUserByEmail(dto.email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );

    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const payload: IJwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return { access_token: accessToken };
  }

  private getBlacklistedCacheKeyByToken(token: string) {
    const cacheKey = this.cacheService.getCacheKey('auth', 'blacklist', token);
    return cacheKey;
  }
  async logout(token: string, user: ParsedTokenData): Promise<boolean> {
    if (!user || !user.exp) throw new UnauthorizedException('Invalid token');

    const ttl = user.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      const cacheKey = this.getBlacklistedCacheKeyByToken(token);
      await this.cacheService.setValue(cacheKey, true, ttl * 1000);
    }

    return true;
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const cacheKey = this.getBlacklistedCacheKeyByToken(token);
    return !!(await this.cacheService.getValue(cacheKey));
  }
}
