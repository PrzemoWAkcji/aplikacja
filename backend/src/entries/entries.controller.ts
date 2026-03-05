import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Post()
  create(@Body() createEntryDto: CreateEntryDto) {
    return this.entriesService.create(createEntryDto);
  }

  @Get()
  findAll(@Query('eventId') eventId?: string) {
    if (eventId) {
      return this.entriesService.findByEvent(eventId);
    }
    return this.entriesService.findAll();
  }

  @Get('athletes/search')
  searchAthletes(@Query('q') query: string) {
    return this.entriesService.searchAthletes(query);
  }

  @Get('athletes/by-club')
  findAthletesByClub(@Query('club') club: string) {
    return this.entriesService.findAthletesByClub(club);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.entriesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEntryDto: UpdateEntryDto) {
    return this.entriesService.update(id, updateEntryDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.entriesService.remove(id);
  }
}
