import { ApiProperty } from '@nestjs/swagger';

export class SignUpResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;
}

export class LoginResponseDto {
  @ApiProperty()
  access_token: string;
}
