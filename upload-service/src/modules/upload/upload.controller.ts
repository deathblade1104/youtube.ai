import {
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';

@Controller({ path: 'upload', version: '1' })
@ApiTags('Upload Controller')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('/')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file to object storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'File uploaded successfully' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'File uploaded successfully' },
            key: { type: 'string', example: 'example.png' },
            location: { type: 'string', example: 'my-bucket/example.png' },
          },
        },
      },
    },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const data = await this.uploadService.uploadBuffer(file);
    return {
      message: 'File uploaded successfully',
      data,
    };
  }
}
