import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('meetings')
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Post()
    create(@Body() createMeetingDto: CreateMeetingDto, @Request() req: any) {
        return this.meetingsService.create(createMeetingDto, req.user.userId);
    }

    @Get()
    findAll() {
        return this.meetingsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.meetingsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto) {
        return this.meetingsService.update(id, updateMeetingDto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.meetingsService.remove(id);
    }
}
