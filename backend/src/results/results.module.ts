import { Module, forwardRef } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ResultsGateway } from './results.gateway';
import { FileWatcherService } from './file-watcher.service';
import { BullModule } from '@nestjs/bullmq';
import { ResultsProcessor } from './results.processor';
import { PointsService } from './points.service';
import { MultiEventScoringService } from './multi-event-scoring.service';
import { BroadcastModule } from '../broadcast/broadcast.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BroadcastModule),
    BullModule.registerQueue({
      name: 'results-queue',
    }),
  ],
  controllers: [ResultsController],
  providers: [
    ResultsService,
    ResultsGateway,
    FileWatcherService,
    ResultsProcessor,
    PointsService,
    MultiEventScoringService,
  ],
  exports: [ResultsService, ResultsGateway, PointsService, MultiEventScoringService],
})
export class ResultsModule {}
