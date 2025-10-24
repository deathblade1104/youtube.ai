// import { ValidationPipe, VersioningType } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import helmet from 'helmet';
// import { AppModule } from './app.module';
// import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
// import { ResponseInterceptor } from './common/interceptors/response.interceptor';
// import { setupSwagger } from './configs/swagger.config';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule, {
//     bufferLogs: true,
//     snapshot: true,
//   });

//   app.useGlobalPipes(
//     new ValidationPipe({
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       transform: true,
//     }),
//   );

//   app.setGlobalPrefix('api');
//   app.enableVersioning({ type: VersioningType.URI });
//   app.useGlobalFilters(new AllExceptionsFilter());
//   app.useGlobalInterceptors(new ResponseInterceptor());
//   app.use(helmet());
//   app.enableShutdownHooks();
//   app.enableCors();
//   setupSwagger(app);
//   const port = process.env.PORT || 8081;
//   await app.listen(port);

//   console.log(`🚀 Upload Service running on http://localhost:${port}`);
// }
// bootstrap();

// src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'transcribe-service',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'transcribe-consumer-group',
        createPartitioner: Partitioners.LegacyPartitioner,
      },
    },
  });

  await app.listen();
  console.log('✍️ Transcoder Service is listening for Kafka events...');
}
bootstrap();
