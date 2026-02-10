import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule { }

