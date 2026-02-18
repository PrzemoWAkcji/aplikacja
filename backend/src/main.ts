import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Monitoring & Logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Enable CORS for frontend
  app.enableCors({
    origin: true, // Allow requests from any origin with credentials (reflects request origin)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
