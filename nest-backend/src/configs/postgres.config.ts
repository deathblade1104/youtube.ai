/* eslint-disable no-process-env */
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CONFIG } from '../common/enums/config.enums';

config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST as string,
  port: parseInt(process.env.DB_PORT as string),
  username: process.env.PG_USER as string,
  password: process.env.PG_PASSWORD as string,
  database: process.env.DB_NAME as string,
  schema: process.env.DB_SCHEMA as string,
  entities: [
    'dist/modules/**/entities/*.entity{.ts,.js}',
    'dist/src/modules/**/entities/*.entity{.ts,.js}',
  ],
  migrations: ['dist/database/postgres/migrations/*{.ts,.js}'],
  synchronize: true,
};

export const postgresDataSource = new DataSource(dataSourceOptions);

export default registerAs(
  CONFIG.POSTGRES,
  (): TypeOrmModuleOptions => dataSourceOptions,
);
