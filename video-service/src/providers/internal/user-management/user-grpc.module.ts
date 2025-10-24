import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { CONFIG } from '../../../common/enums/config.enums';
import { IInternalConfig } from '../../../configs/internal.config';

export const USER_GRPC = 'USER_GRPC';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: USER_GRPC,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const internalConfig = configService.getOrThrow<IInternalConfig>(
            CONFIG.INTERNAL,
          );
          return {
            transport: Transport.GRPC,
            options: {
              url: internalConfig.user_management.grpc_url,
              package: 'user',
              protoPath: join(__dirname, './proto/user.proto'),
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class UserGrpcModule {}
