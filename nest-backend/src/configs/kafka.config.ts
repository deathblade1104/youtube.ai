import { registerAs } from '@nestjs/config';
import { config } from 'dotenv';
import { CONFIG } from '../common/enums/config.enums';
config();

export interface IKafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export default registerAs(
  CONFIG.KAFKA,
  (): IKafkaConfig => ({
    brokers: process.env.KAFKA_BROKERS.split(',') as string[],
    clientId: process.env.KAFKA_CLIENT_ID as string,
    groupId: process.env.KAFKA_GROUP_ID as string,
  }),
);
