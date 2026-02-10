import { Module } from '@nestjs/common';
import { FileMappingService } from './file-mapping.service';
import { FileMappingController } from './file-mapping.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [FileMappingService],
  controllers: [FileMappingController]
})
export class FileMappingModule { }
