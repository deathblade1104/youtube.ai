import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import authConfig from './configs/auth.config';
import awsConfig from './configs/aws.config';
import postgresConfig from './configs/postgres.config';
import redisConfig from './configs/redis.config';
import serverConfig from './configs/server.config';
import { TranscribeModule } from './modules/transcribe/transcribe.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [serverConfig, redisConfig, authConfig, postgresConfig, awsConfig],
      envFilePath: '.env',
    }),
    //PostgresDatabaseModule,
    //RedisCacheModule,
    //UserModule,
    //AuthModule,
    //HealthModule,
    TranscribeModule,
  ],
  //controllers: [AppController],
  //providers: [AppService],
})
export class AppModule {}
