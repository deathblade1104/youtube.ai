import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { IAuthConfig } from '../../configs/auth.config';
import { RedisCacheModule } from '../../database/redis/redis-cache.module';
import { CONFIG } from '../enums/config.enums';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  imports: [
    RedisCacheModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const authConfig = configService.getOrThrow<IAuthConfig>(CONFIG.AUTH);
        return {
          secret: authConfig.jwtSecret,
          signOptions: { expiresIn: authConfig.jwtExpiry || '15m' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
