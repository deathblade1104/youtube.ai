import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CONFIG } from '../../common/enums/config.enums';
import { PostgresDatabaseService } from './postgres-database.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow<TypeOrmModuleOptions>(CONFIG.POSTGRES),
    }),
  ],
  providers: [PostgresDatabaseService],
})
export class PostgresDatabaseModule {}
