import { Controller, Get, Post, Param, Res, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { FileMappingService } from './file-mapping.service';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('file-mapping')
export class FileMappingController {
    constructor(private readonly fileMappingService: FileMappingService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Get('export/csv/:eventId')
    async exportCsv(@Param('eventId') eventId: string, @Res() res: Response) {
        const csv = await this.fileMappingService.exportStartListCsv(eventId);
        res.header('Content-Type', 'text/csv');
        res.attachment(`start_list_${eventId}.csv`);
        return res.send(csv);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Get('export/evt/:eventId')
    async exportEvt(@Param('eventId') eventId: string, @Res() res: Response) {
        const evt = await this.fileMappingService.exportFinishLynxEvt(eventId);
        res.header('Content-Type', 'text/plain');
        res.attachment(`${eventId}.evt`);
        return res.send(evt);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ORGANIZER, Role.ADMIN)
    @Post('import/federation/:meetingId')
    @UseInterceptors(FileInterceptor('file'))
    async importFederation(
        @Param('meetingId') meetingId: string,
        @UploadedFile() file: any,
    ) {
        return this.fileMappingService.importFederationCsv(meetingId, file.buffer);
    }
}
