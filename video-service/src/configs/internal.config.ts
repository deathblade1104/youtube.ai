import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';

config();

export interface IInternalConfig {
  user_management: {
    grpc_url: string;
  };
}

export default registerAs(
  CONFIG.SERVER,
  (): IInternalConfig => ({
    user_management: {
      grpc_url: process.env.UMS_GRPC_URL as string,
    },
  }),
);
