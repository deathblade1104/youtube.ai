import { Module } from '@nestjs/common';
import { UserGrpcModule } from '../user-grpc.module';
import { UserGrpcClient } from './user.grpc.client';

@Module({
  imports: [UserGrpcModule],
  providers: [UserGrpcClient],
  exports: [UserGrpcClient],
})
export class UserGrpcClientModule {}
