import { Module, FactoryProvider, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpensearchService } from './opensearch.service';
import { IOpensearchConfig } from '../../configs/opensearch.config';
import { CONFIG } from '../../common/enums/config.enums';

const opensearchClientFactory: FactoryProvider<Client> = {
  provide: 'OPENSEARCH_CLIENT',
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const opensearchConfig = config.getOrThrow<IOpensearchConfig>(
      CONFIG.OPENSEARCH,
    );
    try {
      return new Client({
        node: opensearchConfig.host,
        auth: {
          username: opensearchConfig.user,
          password: opensearchConfig.password,
        },
        ssl: {
          rejectUnauthorized: false,
        },
      });
    } catch (error) {
      Logger.error('Failed to create Open search client:', error);
      throw error;
    }
  },
};

@Module({
  imports: [ConfigModule],
  providers: [opensearchClientFactory, OpensearchService],
  exports: [OpensearchService],
})
export class OpensearchModule {}
