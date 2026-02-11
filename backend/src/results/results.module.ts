import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ResultsGateway } from './results.gateway';
import { FileWatcherService } from './file-watcher.service';
import { BullModule } from '@nestjs/bullmq';
import { ResultsProcessor } from './results.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'results-queue',
    }),
  ],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsGateway, FileWatcherService, ResultsProcessor],
  exports: [ResultsService, ResultsGateway],
})
export class ResultsModule { }
