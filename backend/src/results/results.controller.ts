import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { MultiEventScoringService } from './multi-event-scoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('results')
export class ResultsController {
  constructor(
    private readonly resultsService: ResultsService,
    private readonly multiEventScoringService: MultiEventScoringService,
  ) {}

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
  @Post('import/evt/:eventId')
  @UseInterceptors(FileInterceptor('file'))
  async importEvt(
    @Param('eventId') eventId: string,
    @UploadedFile() file: any,
  ) {
    return this.resultsService.importEvt(eventId, file.buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateResultDto: any) {
    return this.resultsService.update(id, updateResultDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post('wind')
  async updateHeatWind(
    @Body() data: { eventId: string; heat: number; wind: any },
  ) {
    return this.resultsService.updateHeatWind(
      data.eventId,
      data.heat,
      data.wind,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resultsService.remove(id);
  }

  // --- Multi-event scoring (wieloboje) ---

  /** Oblicz punkty IAAF dla jednej próby: POST /results/multi-event/score */
  @Post('multi-event/score')
  calcPoints(
    @Body() body: { eventCode: string; performance: string; type: string },
  ) {
    return {
      points: this.multiEventScoringService.calcPoints(
        body.eventCode,
        body.performance,
        body.type as any,
      ),
    };
  }

  /** Oblicz klasyfikację wieloboju dla listy wyników: POST /results/multi-event/total */
  @Post('multi-event/total')
  calcTotal(
    @Body() body: { results: Record<string, string>; type: string },
  ) {
    return this.multiEventScoringService.calcTotal(body.results, body.type as any);
  }

  /** Automatyczne wykrycie typu wieloboju na podstawie nazwy i płci */
  @Get('multi-event/detect')
  detectType(
    @Query('name') name: string,
    @Query('gender') gender: string,
    @Query('ageGroup') ageGroup?: string,
  ) {
    return {
      type: this.multiEventScoringService.detectType(name, gender, ageGroup),
    };
  }
}
