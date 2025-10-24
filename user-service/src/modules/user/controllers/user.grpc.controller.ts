import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserService } from '../user.service';

interface GetUserByIdRequest {
  id: number;
}
interface GetUserByIdResponse {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

@Controller()
export class UserGrpcController {
  constructor(private readonly userService: UserService) {}

  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: GetUserByIdRequest): Promise<GetUserByIdResponse> {
    const user = await this.userService.getUserInfoById(data.id);
    return user as GetUserByIdResponse;
  }
}
