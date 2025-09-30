import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import authConfig from './configs/auth.config';
import postgresConfig from './configs/postgres.config';
import redisConfig from './configs/redis.config';
import serverConfig from './configs/server.config';
import { PostgresDatabaseModule } from './database/postgres/postgres-database.module';
import { RedisCacheModule } from './database/redis/redis-cache.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [serverConfig, redisConfig, authConfig, postgresConfig],
      envFilePath: '.env',
    }),
    PostgresDatabaseModule,
    RedisCacheModule,
    UserModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
