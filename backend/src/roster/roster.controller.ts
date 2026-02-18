import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UploadedFile,
    UseInterceptors,
    Res,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import { RosterService } from './roster.service';

import * as iconv from 'iconv-lite';

@Controller('roster')
export class RosterController {
    constructor(private readonly rosterService: RosterService) { }

    private decodeBuffer(buffer: Buffer): string {
        // Try UTF-8 first
        const utf8String = buffer.toString('utf8');
        // Check if it's a DomTel file (usually contains NrKonkur and semicolons)
        if (utf8String.includes('NrKonkur') || utf8String.includes('NazwaPZLA')) {
            return utf8String;
        }

        // If it looks like Windows-1250 (common in Polish athletic software)
        const cp1250String = iconv.decode(buffer, 'windows-1250');
        if (cp1250String.includes('NrKonkur') || cp1250String.includes('NazwaPZLA')) {
            return cp1250String;
        }

        return utf8String;
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
        const result = await this.rosterService.importEntriesFromCsv(meetingId, csvContent);

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
        const result = await this.rosterService.importResultsFromCsv(meetingId, csvContent);

        return {
            statusCode: HttpStatus.OK,
            message: 'Results imported successfully',
            data: result,
        };
    }

    /**
     * Export entries to Roster Athletics CSV
     * GET /roster/export/entries/:meetingId
     */
    @Get('export/entries/:meetingId')
    async exportEntries(@Param('meetingId') meetingId: string, @Res() res: express.Response) {
        const csv = await this.rosterService.exportEntriesToCsv(meetingId);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="roster-entries-${meetingId}.csv"`);
        res.send(csv);
    }

    /**
     * Export results to Roster Athletics CSV
     * GET /roster/export/results/:meetingId
     */
    @Get('export/results/:meetingId')
    async exportResults(@Param('meetingId') meetingId: string, @Res() res: express.Response) {
        const csv = await this.rosterService.exportResultsToCsv(meetingId);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="roster-results-${meetingId}.csv"`);
        res.send(csv);
    }
}
