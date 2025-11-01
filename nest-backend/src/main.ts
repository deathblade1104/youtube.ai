import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { setupSwagger } from './configs/swagger.config';
import { CONFIG } from './common/enums/config.enums';
import { ConfigService } from '@nestjs/config';
import { IKafkaConfig } from './configs/kafka.config';
import { Partitioners } from 'kafkajs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    snapshot: true,
  });

  // Get Kafka config
  const configService = app.get(ConfigService);
  const kafkaConfig = configService.getOrThrow<IKafkaConfig>(CONFIG.KAFKA);

  // Connect Kafka microservice for consumers
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: kafkaConfig.clientId,
        brokers: kafkaConfig.brokers,
      },
      consumer: {
        groupId: kafkaConfig.groupId,
      },
      producer: {
        allowAutoTopicCreation: true,
        createPartitioner: Partitioners.LegacyPartitioner,
      },
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use(helmet());
  app.enableShutdownHooks();
  app.enableCors();
  setupSwagger(app);

  // Start all microservices (Kafka consumers)
  await app.startAllMicroservices();

  const port = process.env.PORT || 8080;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Youtube Service running on http://localhost:${port}`);
  logger.log(`📨 Kafka consumers listening on: ${kafkaConfig.brokers.join(', ')}`);
}
bootstrap();
