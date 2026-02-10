import { Controller, Get, Post, Param, Delete, UseGuards, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) { }

  @Get()
  findAll(@Query('eventId') eventId?: string) {
    if (eventId) {
      return this.resultsService.findByEvent(eventId);
    }
    return this.resultsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resultsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('import/lif/:eventId')
  @UseInterceptors(FileInterceptor('file'))
  async importLif(
    @Param('eventId') eventId: string,
    @UploadedFile() file: any,
  ) {
    return this.resultsService.importLif(eventId, file.buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resultsService.remove(id);
  }
}
