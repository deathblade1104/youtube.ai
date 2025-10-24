import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './common/auth/auth.module';
import authConfig from './configs/auth.config';
import awsConfig from './configs/aws.config';
//import postgresConfig from './configs/postgres.config';
import redisConfig from './configs/redis.config';
import serverConfig from './configs/server.config';
//import { PostgresDatabaseModule } from './database/postgres/postgres-database.module';
import { RedisCacheModule } from './database/redis/redis-cache.module';
import { HealthModule } from './modules/health/health.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [serverConfig, redisConfig, authConfig, awsConfig],
      envFilePath: '.env',
    }),
    //PostgresDatabaseModule,
    RedisCacheModule,
    AuthModule,
    UploadModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
