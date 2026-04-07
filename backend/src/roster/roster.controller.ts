import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import { RosterService } from './roster.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

import { decodeTextBuffer } from '../utils/text-decoder.util';

@Controller('roster')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  private decodeBuffer(buffer: Buffer): string {
    return decodeTextBuffer(buffer);
  }

  /**
   * Import entries from Roster Athletics CSV
   * POST /roster/import/entries/:meetingId
   */
  @Post('import/entries/:meetingId')
  @UseInterceptors(FileInterceptor('file'))
  async importEntries(
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const csvContent = this.decodeBuffer(file.buffer);
    const result = await this.rosterService.importEntriesFromCsv(
      meetingId,
      csvContent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Entries imported successfully',
      data: result,
    };
  }

  /**
   * Import results from Roster Athletics CSV
   * POST /roster/import/results/:meetingId
   */
  @Post('import/results/:meetingId')
  @UseInterceptors(FileInterceptor('file'))
  async importResults(
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const csvContent = this.decodeBuffer(file.buffer);
    const result = await this.rosterService.importResultsFromCsv(
      meetingId,
      csvContent,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Results imported successfully',
      data: result,
    };
  }

  /**
   * Import entries from PZLA Starter website by LP_Impreza number
   * POST /roster/import/pzla/:meetingId?lpImpreza=27
   */
  @Post('import/pzla/:meetingId')
  async importFromPzlaUrl(
    @Param('meetingId') meetingId: string,
    @Query('lpImpreza') lpImpreza: string,
  ) {
    if (!lpImpreza || isNaN(Number(lpImpreza))) {
      throw new BadRequestException('Podaj prawidłowy numer imprezy (lpImpreza)');
    }
    const result = await this.rosterService.importFromPzlaStarterUrl(
      meetingId,
      Number(lpImpreza),
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Zaimportowano ${result.imported} nowych, zaktualizowano ${result.updated} wpisów w ${result.events} konkurencjach`,
      data: result,
    };
  }

  /**
   * Import entries from PZLA Starter CSV file upload
   * POST /roster/import/pzla-csv/:meetingId
   */
  @Post('import/pzla-csv/:meetingId')
  @UseInterceptors(FileInterceptor('file'))
  async importFromPzlaCsv(
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const csvContent = this.decodeBuffer(file.buffer);
    const result = await this.rosterService.importFromPzlaCsvContent(
      meetingId,
      csvContent,
    );
    return {
      statusCode: HttpStatus.OK,
      message: `Zaimportowano ${result.imported} nowych, zaktualizowano ${result.updated} wpisów w ${result.events} konkurencjach`,
      data: result,
    };
  }

  /**
   * Export entries to Roster Athletics CSV
   * GET /roster/export/entries/:meetingId
   */
  @Get('export/entries/:meetingId')
  async exportEntries(
    @Param('meetingId') meetingId: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.rosterService.exportEntriesToCsv(meetingId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="roster-entries-${meetingId}.csv"`,
    );
    res.send(csv);
  }

  /**
   * Export results to Roster Athletics CSV
   * GET /roster/export/results/:meetingId
   */
  @Get('export/results/:meetingId')
  async exportResults(
    @Param('meetingId') meetingId: string,
    @Res() res: express.Response,
  ) {
    const csv = await this.rosterService.exportResultsToCsv(meetingId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="roster-results-${meetingId}.csv"`,
    );
    res.send(csv);
  }
}
