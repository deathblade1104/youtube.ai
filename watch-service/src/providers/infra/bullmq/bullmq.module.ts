import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullQueueService } from './bullmq.service';
import { BullMQConfigService } from './factory/bullmq.factory';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useClass: BullMQConfigService,
    }),
  ],
  providers: [BullQueueService],
  exports: [BullQueueService, BullModule],
})
export class BullMQModule {
  static forFeature(
    queues: Array<{
      name: string;
      defaultJobOptions?: any;
      prefix?: string;
      limiter?: any;
      settings?: any;
    }> = [],
  ): DynamicModule {
    return {
      module: BullMQModule,
      imports: [
        BullModule.registerQueue(
          ...queues.map((queue) => ({
            name: queue.name,
            defaultJobOptions: queue.defaultJobOptions,
            prefix: queue.prefix,
            limiter: queue.limiter,
            settings: queue.settings,
          })),
        ),
      ],
      exports: [BullModule],
    };
  }
}
