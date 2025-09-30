import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';

config();

enum APP_ENV {
  DEVELOPMENT = 'development',
  LOCAL = 'local',
  PRODUCTION = 'prod',
}
export interface IServerConfig {
  serviceName: string;
  port: string;
  env: APP_ENV;
}

export default registerAs(
  CONFIG.SERVER,
  (): IServerConfig => ({
    serviceName: 'trade-matching-service',
    port: process.env.PORT as string,
    env: process.env.NODE_ENV as APP_ENV,
  }),
);
