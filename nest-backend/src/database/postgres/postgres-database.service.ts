import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PostgresDatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(PostgresDatabaseService.name);
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(signal?: string) {
    if (this.dataSource.isInitialized) {
      this.logger.log(`Closing DB connection due to ${signal}`);
      await this.dataSource.destroy();
    }
  }
}
