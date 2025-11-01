import { registerAs } from '@nestjs/config';
import { CONFIG } from '../common/enums/config.enums';

export interface IOpensearchConfig {
  host: string;
  user: string;
  password: string;
}

export default registerAs(CONFIG.OPENSEARCH, () => {
  return {
    host: process.env.OPENSEARCH_HOST,
    user: process.env.OPENSEARCH_USER,
    password: process.env.OPENSEARCH_PASSWORD,
  };
});
