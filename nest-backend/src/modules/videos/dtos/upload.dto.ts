import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  Max,
  Min,
  ValidateNested,
  IsBoolean,
} from 'class-validator';

class UploadPartDto {
  @ApiProperty({ example: '"etag123"' })
  @IsString()
  @IsNotEmpty()
  ETag: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(10000) // S3 limit
  PartNumber: number;
}

export class InitializeUploadDto {
  @ApiProperty({ example: 'myvideo.mp4' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether user wants to upload a custom thumbnail',
  })
  @IsOptional()
  @IsBoolean()
  has_custom_thumbnail?: boolean;
}

export class GeneratePresignedUrlDto {
  @ApiProperty({ example: 'abc123' })
  @IsString()
  @IsNotEmpty()
  upload_id: string;

  @ApiProperty({ example: 'e7f3a4d6-1b3e-48f2-bb3c-b46f3a4b3124:myvideo.mp4' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(10000) // S3 limit
  part_number: number;
}

export class UploadThumbnailDto {
  @ApiProperty({
    example: 'thumbnail.jpg',
    description: 'Thumbnail filename',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'Thumbnail content type (image/jpeg, image/png)',
  })
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @ApiProperty({
    example: 123,
    description: 'Video ID to attach thumbnail to',
  })
  @IsInt()
  video_id: number;
}

export class CompleteUploadDto {
  @ApiProperty({ example: 'e7f3a4d6-1b3e-48f2-bb3c-b46f3a4b3124:myvideo.mp4' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'abc123' })
  @IsString()
  @IsNotEmpty()
  upload_id: string;

  @ApiProperty({
    example: [
      { ETag: '"etag123"', PartNumber: 1 },
      { ETag: '"etag456"', PartNumber: 2 },
    ],
    type: [UploadPartDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts: UploadPartDto[];
}

export class AbortUploadDto {
  @ApiProperty({ example: 'abc123' })
  @IsString()
  @IsNotEmpty()
  upload_id: string;

  @ApiProperty({
    example: 'd3f7e1d4-08a1-4a44-90f0-72d73e2f38e7:myvideo.mp4',
  })
  @IsString()
  @IsNotEmpty()
  key: string;
}

export class SaveVideoDto {
  @ApiProperty({ example: 'My First Video' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'A test video upload' })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'd3f7e1d4-08a1-4a44-90f0-72d73e2f38e7:myvideo.mp4',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({
    example: 'd3f7e1d4-08a1-4a44-90f0-72d73e2f38e7:thumbnail.jpg',
    description: 'S3 key of custom thumbnail (if uploaded)',
  })
  @IsOptional()
  @IsString()
  thumbnail_key?: string;
}
