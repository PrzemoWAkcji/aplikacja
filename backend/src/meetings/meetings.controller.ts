import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id/events')
  removeAllEvents(@Param('id') id: string) {
    return this.meetingsService.deleteAllEvents(id);
  }

  @Post(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meetingsService.uploadLogo(id, file);
  }

  @Post(':id/sponsor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadSponsor(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.meetingsService.uploadSponsor(id, file);
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  removeLogo(@Param('id') id: string) {
    return this.meetingsService.removeLogo(id);
  }

  @Delete(':id/sponsors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  clearSponsors(@Param('id') id: string) {
    return this.meetingsService.clearSponsors(id);
  }

  @Get('uploads/:filename')
  getUploadedFile(@Param('filename') filename: string, @Res() res: any) {
    return this.meetingsService.getUploadedFile(filename, res);
  }

  @Get(':id/print-data')
  getPrintData(@Param('id') id: string) {
    return this.meetingsService.getPrintData(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get(':id/finishlynx-export')
  getFinishLynxExport(@Param('id') id: string) {
    return this.meetingsService.generateFinishLynxFiles(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Post(':id/finishlynx-generate')
  generateFinishLynxOnDisk(
    @Param('id') id: string,
    @Body() body?: { exportPath?: string },
  ) {
    return this.meetingsService.writeFinishLynxFilesToDisk(
      id,
      body?.exportPath,
    );
  }
}
