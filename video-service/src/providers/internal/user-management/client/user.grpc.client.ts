import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { UserServiceClient } from '../interfaces';
import { USER_GRPC } from '../user-grpc.module';

@Injectable()
export class UserGrpcClient implements OnModuleInit {
  private client!: UserServiceClient;

  constructor(@Inject(USER_GRPC) private readonly grpc: ClientGrpc) {}

  onModuleInit() {
    // Must match the service name in proto: "UserService"
    this.client = this.grpc.getService<UserServiceClient>('UserService');
  }

  svc() {
    return this.client;
  }
}
