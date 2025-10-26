import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class InitializeUploadDto {
  @ApiProperty({ example: 'myvideo.mp4' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  content_type: string;
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
  part_number: number;
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
  })
  parts: { ETag: string; PartNumber: number }[];
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
}
