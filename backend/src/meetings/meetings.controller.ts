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
  Query,
} from '@nestjs/common';
import { getAgeCategoryBounds, getAgeCategory } from '../common/age-category.util';
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

  @Get('public')
  findAllPublic() {
    return this.meetingsService.findAll();
  }

  @Get('public/:id')
  findOnePublic(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('private')
  findAllPrivate() {
    return this.meetingsService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Get('private/:id')
  findOnePrivate(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMeetingDto: UpdateMeetingDto, @Request() req: any) {
    return this.meetingsService.update(id, updateMeetingDto, req.user.userId, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.meetingsService.remove(id, req.user.userId, req.user.role);
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

  @Get(':id/team-standings')
  getTeamStandings(@Param('id') id: string) {
    return this.meetingsService.getTeamStandings(id);
  }

  // Returns age category bounds for a given year (or current year)
  @Get('utils/age-categories')
  getAgeCategories(@Query('year') year?: string) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    return getAgeCategoryBounds(y);
  }

  // Calculate category for a single athlete
  @Get('utils/age-category')
  getAthleteAgeCategory(
    @Query('yearOfBirth') yearOfBirth: string,
    @Query('year') year?: string,
  ) {
    const yob = parseInt(yearOfBirth);
    const y = year ? parseInt(year) : new Date().getFullYear();
    if (isNaN(yob)) return { category: null };
    return { category: getAgeCategory(yob, y) };
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
  generateFinishLynxOnDisk(@Param('id') id: string) {
    // exportPath pochodzi wyłącznie z env FINISHLYNX_EXPORT_DIR — nigdy z body
    return this.meetingsService.writeFinishLynxFilesToDisk(id);
  }
}
