import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IJwtPayload {
  @ApiProperty()
  sub: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;
}

export class ParsedTokenData extends IJwtPayload {
  @ApiPropertyOptional()
  iss: string;

  @ApiPropertyOptional()
  exp: number;

  @ApiPropertyOptional()
  iat: number;

  @ApiPropertyOptional()
  jti: string;
}
