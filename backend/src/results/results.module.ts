import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ResultsGateway } from './results.gateway';
import { FileWatcherService } from './file-watcher.service';

@Module({
  imports: [PrismaModule],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsGateway, FileWatcherService],
  exports: [ResultsService, ResultsGateway],
})
export class ResultsModule { }
