import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Nagłówki bezpieczeństwa HTTP (M-2)
  app.use(helmet());

  // Monitoring & Logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Globalna walidacja i sanitizacja DTO (M-1)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // Usuwa pola nieobecne w DTO
    forbidNonWhitelisted: true, // Błąd przy nieznanych polach
    transform: true,            // Automatyczna konwersja typów
  }));

  // CORS — tylko dozwolone originy z env (H-1)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}
bootstrap();
