import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FileMappingService } from './file-mapping.service';
import { FileMappingController } from './file-mapping.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EntriesModule } from '../entries/entries.module';

@Module({
  imports: [HttpModule, PrismaModule, EntriesModule],
  providers: [FileMappingService],
  controllers: [FileMappingController],
})
export class FileMappingModule {}
