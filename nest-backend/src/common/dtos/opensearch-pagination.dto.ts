import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { OPENSEARCH_QUERY_TYPES } from '../../database/opensearch/opensearch.constants';

export enum Direction {
  NEXT = 'next',
  PREVIOUS = 'previous',
}

export class PaginationDto {
  @IsOptional()
  @IsEnum(Direction)
  @ApiPropertyOptional({
    enum: Direction,
    default: Direction.NEXT,
    description: 'Direction to move, next or previous',
  })
  direction?: Direction = Direction.NEXT;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    required: false,
    description: 'Cursor position',
  })
  cursor?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ default: 10, description: 'Number of hits per page' })
  size?: number = 10;
}

export class MatchFieldsDto {
  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsOptional()
  query: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
  })
  @IsArray()
  @IsString({ each: true })
  fields: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  type?: OPENSEARCH_QUERY_TYPES;

  @ApiPropertyOptional()
  @IsOptional()
  fuzziness?: string | number;
}

export class GenericMatchDto {
  @ApiPropertyOptional({ type: [MatchFieldsDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchFieldsDto)
  match?: MatchFieldsDto[];
}
export class GenericMustMatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  must_match?: Record<string, any>[];
}
export class GenericMustNotMatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  must_not_match?: Record<string, any>[];
}

export class SearchQueryDto extends IntersectionType(
  GenericMustMatchDto,
  GenericMatchDto,
  GenericMustNotMatchDto,
) {}

export class PaginationResponseDto {
  @ApiProperty({
    type: String,
  })
  prev_cursor: string | number;

  @ApiProperty({
    type: String,
  })
  next_cursor: string | number;

  @ApiProperty({
    type: Number,
  })
  size?: number;

  @ApiProperty({
    type: Number,
  })
  total?: number;
}

export class PaginatedResponseDto {
  @ApiProperty({
    type: PaginationResponseDto,
  })
  pagination: PaginationResponseDto;
}
