import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';

config();
export interface IAuthConfig {
  jwtSecret: string;
  jwtExpiry: string;
}

export default registerAs(
  CONFIG.AUTH,
  (): IAuthConfig => ({
    jwtSecret: process.env.JWT_SECRET as string,
    jwtExpiry: process.env.JWT_EXPIRY as string,
  }),
);
