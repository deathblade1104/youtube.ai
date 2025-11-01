import {
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseIntPipe,
    Query,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CONFIG } from '../../../common/enums/config.enums';
import { IAuthConfig } from '../../../configs/auth.config';
import { AuthService } from '../../auth/auth.service';
import { WatchService } from '../services/watch/watch.service';

@Controller({ path: 'watch', version: '1' })
@ApiTags('Watch Controller')
export class WatchController {
  constructor(
    private readonly watchService: WatchService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('hls/:videoId/master.m3u8')
  @ApiOperation({
    summary: 'Get HLS master manifest for video streaming',
    description:
      'Note: Token can be passed as query parameter (token) or Authorization header. Video players cannot send custom headers.',
  })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT token for authentication (alternative to Authorization header)',
  })
  async getHLSManifest(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Verify authentication - video players can't send custom headers, so we accept token in query
    const authToken =
      token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!authToken) {
      throw new UnauthorizedException('Token required');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.authService.isBlacklisted(authToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    // Verify and decode token
    let decodedToken: any;
    try {
      const authConfig = this.configService.getOrThrow<IAuthConfig>(
        CONFIG.AUTH,
      );
      decodedToken = this.jwtService.verify(authToken, {
        secret: authConfig.jwtSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Verify video exists and user has access (optional: can be removed for public videos)
    // For now, we'll just verify the token is valid and let the service check video existence

    try {
      // Get base URL from request (protocol + host)
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:8080';
      const baseUrl = `${protocol}://${host}`;

      // Include token in variant URLs so they're authenticated too
      const manifest = await this.watchService.generateHLSManifest(
        videoId,
        baseUrl,
        authToken, // Pass token so variant URLs can include it
      );

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(manifest);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Failed to generate HLS manifest');
    }
  }

  @Get('hls/:videoId/variants/:resolution/playlist.m3u8')
  @ApiOperation({
    summary: 'Get HLS variant playlist (.m3u8)',
    description: 'Returns presigned URL to variant playlist',
  })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiParam({ name: 'resolution', enum: ['1080p', '720p', '480p', '360p'] })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT token for authentication',
  })
  async getVariantPlaylist(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('resolution') resolution: string,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Verify authentication
    const authToken =
      token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!authToken) {
      throw new UnauthorizedException('Token required');
    }

    const isBlacklisted = await this.authService.isBlacklisted(authToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    let decodedToken: any;
    try {
      const authConfig = this.configService.getOrThrow<IAuthConfig>(
        CONFIG.AUTH,
      );
      decodedToken = this.jwtService.verify(authToken, {
        secret: authConfig.jwtSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const variantResolution = resolution as any;

    // Get base URL from request
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8080';
    const baseUrl = `${protocol}://${host}`;

    // Get playlist content with updated segment URLs
    const playlistContent = await this.watchService.getVariantPlaylistContent(
      videoId,
      variantResolution,
      baseUrl,
      authToken,
    );

    // Serve playlist content directly
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(playlistContent);
  }

  @Get('hls/:videoId/variants/:resolution/:segmentName')
  @ApiOperation({ summary: 'Get HLS segment (.ts file)' })
  @ApiParam({ name: 'videoId', type: Number })
  @ApiParam({ name: 'resolution', enum: ['1080p', '720p', '480p', '360p'] })
  @ApiParam({ name: 'segmentName', description: 'Segment filename (e.g., segment_000.ts)' })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT token for authentication',
  })
  async getVariantSegment(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Param('resolution') resolution: string,
    @Param('segmentName') segmentName: string,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Verify authentication
    const authToken =
      token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (!authToken) {
      throw new UnauthorizedException('Token required');
    }

    const isBlacklisted = await this.authService.isBlacklisted(authToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token is blacklisted');
    }

    let decodedToken: any;
    try {
      const authConfig = this.configService.getOrThrow<IAuthConfig>(
        CONFIG.AUTH,
      );
      decodedToken = this.jwtService.verify(authToken, {
        secret: authConfig.jwtSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const variantResolution = resolution as any;

    // segmentName is required for HLS segments
    if (!segmentName) {
      throw new NotFoundException('Segment name is required for HLS segments');
    }

    const segmentUrl = await this.watchService.getVariantSegmentUrl(
      videoId,
      variantResolution,
      segmentName,
    );

    // Redirect to presigned URL
    res.redirect(segmentUrl);
  }
}
