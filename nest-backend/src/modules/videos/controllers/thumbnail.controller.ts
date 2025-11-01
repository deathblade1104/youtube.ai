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
import { UploadThumbnailDto } from '../dtos/upload.dto';
import { UploadService } from '../services/upload/upload.service';

@Controller({ path: 'upload', version: '1' })
@ApiTags('Upload Controller')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ThumbnailController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('thumbnail')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Upload custom thumbnail for a video',
  })
  async uploadThumbnail(
    @Body() dto: UploadThumbnailDto,
    @Req() req: CustomExpressRequest,
  ) {
    const data = await this.uploadService.uploadThumbnail(dto, req.user.sub);
    return {
      message: 'Thumbnail upload initialized',
      data,
    };
  }
}
