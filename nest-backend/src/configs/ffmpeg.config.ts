import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';

config();

export interface IFfmpegConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
}

export default registerAs(
  CONFIG.FFMPEG,
  (): IFfmpegConfig => ({
    ffmpegPath: process.env.FFMPEG_PATH,
    ffprobePath: process.env.FFPROBE_PATH,
  }),
);
