import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/user.controller';
import { UserGrpcController } from './controllers/user.grpc.controller';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController, UserGrpcController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
