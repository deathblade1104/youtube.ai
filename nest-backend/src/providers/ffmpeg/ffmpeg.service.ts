import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { CONFIG } from '../../common/enums/config.enums';
import { IFfmpegConfig } from '../../configs/ffmpeg.config';
import { VideoResolution } from '../../database/postgres/entities/video-variant.entity';
import ffmpeg = require('fluent-ffmpeg');

export interface TranscodeOptions {
  inputPath: string;
  outputPath: string;
  resolution: VideoResolution;
  width?: number;
  height?: number;
  bitrate?: string;
}

export interface TranscodeResult {
  outputPath: string;
  width: number;
  height: number;
  bitrate: string;
  sizeBytes: number;
  duration: number;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly ffmpegPath?: string;
  private readonly ffprobePath?: string;

  constructor(private readonly configService: ConfigService) {
    // Get FFmpeg configuration
    const ffmpegConfig = this.configService.getOrThrow<IFfmpegConfig>(
      CONFIG.FFMPEG,
    );

    // Set custom FFmpeg paths from configuration if provided
    if (ffmpegConfig.ffmpegPath) {
      this.ffmpegPath = ffmpegConfig.ffmpegPath;
      ffmpeg.setFfmpegPath(this.ffmpegPath);
      this.logger.log(`✅ Using custom FFmpeg path: ${this.ffmpegPath}`);
    }

    if (ffmpegConfig.ffprobePath) {
      this.ffprobePath = ffmpegConfig.ffprobePath;
      ffmpeg.setFfprobePath(this.ffprobePath);
      this.logger.log(`✅ Using custom FFprobe path: ${this.ffprobePath}`);
    }

    // Log warning if FFmpeg not found (fluent-ffmpeg will try to find it)
    if (!this.ffmpegPath) {
      this.logger.warn(
        '⚠️ FFMPEG_PATH not set - using system PATH. Install FFmpeg or set FFMPEG_PATH env var.',
      );
    }
  }

  /**
   * Get video metadata (duration, resolution, etc.)
   */
  async getVideoMetadata(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    bitrate: number;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          this.logger.error(`Failed to get video metadata: ${err.message}`);
          reject(
            new InternalServerErrorException('Failed to read video metadata'),
          );
          return;
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === 'video',
        );

        if (!videoStream) {
          reject(new BadRequestException('No video stream found'));
          return;
        }

        resolve({
          duration: Math.floor(metadata.format.duration || 0),
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          bitrate: parseInt(String(metadata.format.bit_rate || '0'), 10),
        });
      });
    });
  }

  /**
   * Transcode video to specific resolution
   */
  async transcodeVideo(options: TranscodeOptions): Promise<TranscodeResult> {
    const { inputPath, outputPath, resolution, width, height, bitrate } =
      options;

    // Get resolution dimensions if not provided
    let targetWidth = width;
    let targetHeight = height;
    let targetBitrate = bitrate;

    if (!targetWidth || !targetHeight) {
      const dimensions = this.getResolutionDimensions(resolution);
      targetWidth = dimensions.width;
      targetHeight = dimensions.height;
    }

    if (!targetBitrate) {
      targetBitrate = this.getRecommendedBitrate(resolution);
    }

    this.logger.log(
      `🎬 Transcoding to ${resolution} (${targetWidth}x${targetHeight}) with bitrate ${targetBitrate}`,
    );

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${targetWidth}x${targetHeight}`)
        .videoBitrate(targetBitrate.toString())
        .format('mp4')
        .outputOptions(['-preset fast', '-movflags +faststart'])
        .on('start', (cmdline) => {
          this.logger.debug(`FFmpeg command: ${cmdline}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `Transcoding progress: ${Math.floor(progress.percent || 0)}%`,
          );
        })
        .on('end', async () => {
          try {
            const stats = await fs.stat(outputPath);
            const metadata = await this.getVideoMetadata(outputPath);
            const fileSize = stats.size;

            this.logger.log(
              `✅ Transcoding completed: ${resolution} (${fileSize} bytes)`,
            );

            resolve({
              outputPath,
              width: targetWidth,
              height: targetHeight,
              bitrate: targetBitrate,
              sizeBytes: fileSize,
              duration: metadata.duration,
            });
          } catch (error) {
            this.logger.error(`Failed to get transcoded file stats: ${error}`);
            reject(
              new InternalServerErrorException(
                'Failed to verify transcoded file',
              ),
            );
          }
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg transcoding error: ${err.message}`);
          reject(
            new InternalServerErrorException(
              `Video transcoding failed: ${err.message}`,
            ),
          );
        });

      command.save(outputPath);
    });
  }

  /**
   * Get resolution dimensions from enum
   */
  private getResolutionDimensions(resolution: VideoResolution): {
    width: number;
    height: number;
  } {
    const dimensions: Record<
      VideoResolution,
      { width: number; height: number }
    > = {
      [VideoResolution.P1080]: { width: 1920, height: 1080 },
      [VideoResolution.P720]: { width: 1280, height: 720 },
      [VideoResolution.P480]: { width: 854, height: 480 },
      [VideoResolution.P360]: { width: 640, height: 360 },
    };

    return dimensions[resolution];
  }

  /**
   * Get recommended bitrate for resolution
   */
  private getRecommendedBitrate(resolution: VideoResolution): string {
    const bitrates: Record<VideoResolution, string> = {
      [VideoResolution.P1080]: '5000k',
      [VideoResolution.P720]: '2500k',
      [VideoResolution.P480]: '1000k',
      [VideoResolution.P360]: '500k',
    };

    return bitrates[resolution];
  }

  /**
   * Extract audio from video file
   * @param inputPath Path to video file
   * @param outputPath Path to save extracted audio (usually .wav)
   * @returns Promise resolving to output path
   */
  async extractAudio(inputPath: string, outputPath: string): Promise<string> {
    this.logger.log(`🎵 Extracting audio from ${inputPath}`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .on('start', (cmdline) => {
          this.logger.debug(`FFmpeg audio extraction command: ${cmdline}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `Audio extraction progress: ${Math.floor(progress.percent || 0)}%`,
          );
        })
        .on('end', () => {
          this.logger.log(`✅ Audio extracted to ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg audio extraction error: ${err.message}`);
          reject(
            new InternalServerErrorException(
              `Audio extraction failed: ${err.message}`,
            ),
          );
        });

      command.save(outputPath);
    });
  }

  /**
   * Transcode and segment video for HLS streaming
   * Creates .ts segments and .m3u8 playlist for a specific resolution
   */
  async transcodeToHLS(options: {
    inputPath: string;
    outputDir: string;
    playlistName: string;
    resolution: VideoResolution;
    width?: number;
    height?: number;
    bitrate?: string;
    segmentDuration?: number; // Duration of each segment in seconds (default: 10)
  }): Promise<{
    playlistPath: string;
    segmentCount: number;
    width: number;
    height: number;
    bitrate: string;
    duration: number;
  }> {
    const {
      inputPath,
      outputDir,
      playlistName,
      resolution,
      width,
      height,
      bitrate,
      segmentDuration = 10,
    } = options;

    // Get resolution dimensions if not provided
    let targetWidth = width;
    let targetHeight = height;
    let targetBitrate = bitrate;

    if (!targetWidth || !targetHeight) {
      const dimensions = this.getResolutionDimensions(resolution);
      targetWidth = dimensions.width;
      targetHeight = dimensions.height;
    }

    if (!targetBitrate) {
      targetBitrate = this.getRecommendedBitrate(resolution);
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, playlistName);
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    this.logger.log(
      `🎬 Transcoding to HLS: ${resolution} (${targetWidth}x${targetHeight}) with bitrate ${targetBitrate}, segment duration: ${segmentDuration}s`,
    );

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${targetWidth}x${targetHeight}`)
        .videoBitrate(targetBitrate.toString())
        .format('hls') // HLS format
        .outputOptions([
          '-preset fast',
          '-hls_time',
          segmentDuration.toString(), // Segment duration
          '-hls_playlist_type',
          'vod', // Video on Demand (complete segments)
          '-hls_segment_filename',
          segmentPattern, // Segment filename pattern
          '-hls_list_size',
          '0', // Keep all segments in playlist (0 = unlimited)
          '-start_number',
          '0', // Start segment numbering from 0
          '-hls_flags',
          'independent_segments', // Each segment can be decoded independently
        ])
        .output(playlistPath)
        .on('start', (cmdline) => {
          this.logger.debug(`FFmpeg HLS command: ${cmdline}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `HLS transcoding progress: ${Math.floor(progress.percent || 0)}%`,
          );
        })
        .on('end', async () => {
          try {
            // Read the generated playlist to count segments
            const playlistContent = await fs.readFile(playlistPath, 'utf-8');
            const segmentMatches = playlistContent.match(/segment_\d+\.ts/g);
            const segmentCount = segmentMatches ? segmentMatches.length : 0;

            // Get metadata from original video for duration
            const metadata = await this.getVideoMetadata(inputPath);

            this.logger.log(
              `✅ HLS transcoding completed: ${resolution}, ${segmentCount} segments`,
            );

            resolve({
              playlistPath,
              segmentCount,
              width: targetWidth,
              height: targetHeight,
              bitrate: targetBitrate,
              duration: metadata.duration,
            });
          } catch (error) {
            this.logger.error(`Failed to verify HLS output: ${error}`);
            reject(
              new InternalServerErrorException(
                'Failed to verify HLS transcoded files',
              ),
            );
          }
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg HLS transcoding error: ${err.message}`);
          reject(
            new InternalServerErrorException(
              `HLS video transcoding failed: ${err.message}`,
            ),
          );
        });

      command.run();
    });
  }

  /**
   * Extract thumbnail frame from video
   * @param inputPath Path to video file
   * @param outputPath Path to save thumbnail (usually .jpg)
   * @param timeOffset Time offset in seconds (default: 1 second)
   * @returns Promise resolving to output path
   */
  async extractThumbnail(
    inputPath: string,
    outputPath: string,
    timeOffset: number = 1,
  ): Promise<string> {
    this.logger.log(
      `🖼️ Extracting thumbnail from ${inputPath} at ${timeOffset}s`,
    );

    return new Promise((resolve, reject) => {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      fs.mkdir(outputDir, { recursive: true }).catch((err) => {
        this.logger.warn(`Failed to create thumbnail directory: ${err}`);
      });

      const command = ffmpeg(inputPath)
        .seekInput(timeOffset) // Seek to the specified time
        .frames(1) // Extract only 1 frame
        .size('1280x720') // Resize to standard thumbnail size
        .format('image2') // Output as image
        .outputOptions(['-q:v', '2']) // High quality JPEG (scale: 2-31, lower is better)
        .output(outputPath)
        .on('start', (cmdline) => {
          this.logger.debug(`FFmpeg thumbnail extraction command: ${cmdline}`);
        })
        .on('end', () => {
          this.logger.log(`✅ Thumbnail extracted to ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          this.logger.error(
            `FFmpeg thumbnail extraction error: ${err.message}`,
          );
          reject(
            new InternalServerErrorException(
              `Thumbnail extraction failed: ${err.message}`,
            ),
          );
        });

      command.run();
    });
  }
}
