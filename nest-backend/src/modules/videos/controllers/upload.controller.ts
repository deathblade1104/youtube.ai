import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CustomExpressRequest } from '../../../common/interfaces/express-request.interface';
import {
  AbortUploadDto,
  CompleteUploadDto,
  GeneratePresignedUrlDto,
  InitializeUploadDto,
  SaveVideoDto,
} from '../dtos/upload.dto';
import { UploadService } from '../services/upload/upload.service';

@Controller({ path: 'upload', version: '1' })
@ApiTags('Upload Controller')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('init')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Initialize multipart upload and return upload_id & key',
  })
  async initializeUpload(
    @Body() dto: InitializeUploadDto,
    @Req() req: CustomExpressRequest,
  ) {
    const data = await this.uploadService.initializeMultipartUpload(
      dto,
      req.user.sub,
    );
    return {
      message: 'Multipart video upload initialized',
      data,
    };
  }

  @Post('presigned-url')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Generate presigned URL for a specific part upload',
  })
  async generatePresignedUrl(@Body() dto: GeneratePresignedUrlDto) {
    const data = await this.uploadService.generatePresignedUrlForPart(dto);
    return {
      message: 'Presigned URL generated successfully',
      data,
    };
  }

  @Post('complete')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Complete a multipart upload after all parts are uploaded',
  })
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    @Req() req: CustomExpressRequest,
  ) {
    return await this.uploadService.completeMultipartUpload(dto, req.user.sub);
  }

  @Post('save')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Save video details to DB',
  })
  async saveVideo(@Body() dto: SaveVideoDto, @Req() req: CustomExpressRequest) {
    const data = await this.uploadService.saveVideo(dto, req.user.sub);
    return {
      message: 'Video Details saved to DB',
      data,
    };
  }

  @Post('abort')
  @HttpCode(200)
  @ApiOperation({ summary: 'Abort an in-progress multipart upload' })
  async abortUpload(
    @Body() dto: AbortUploadDto,
    @Req() req: CustomExpressRequest,
  ) {
    return await this.uploadService.abortMultipartUpload(dto, req.user.sub);
  }
}
