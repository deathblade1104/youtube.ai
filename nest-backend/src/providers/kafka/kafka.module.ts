// src/kafka/kafka.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { CONFIG } from '../../common/enums/config.enums';
import { IKafkaConfig } from '../../configs/kafka.config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_PRODUCER',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const kafkaConfig = configService.getOrThrow<IKafkaConfig>(
            CONFIG.KAFKA,
          );

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: kafkaConfig.clientId,
                brokers: kafkaConfig.brokers,
              },
              producer: {
                allowAutoTopicCreation: true,
                createPartitioner: Partitioners.LegacyPartitioner,
              },
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
