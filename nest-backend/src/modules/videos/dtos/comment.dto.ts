import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great video!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({
    example: 123,
    description: 'Parent comment ID for replies (null for top-level comments)',
  })
  @IsOptional()
  parent_id?: number | null;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

