import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import * as iconv from 'iconv-lite';

@Injectable()
export class FileMappingService {
    constructor(private prisma: PrismaService) { }

    async exportStartListCsv(eventId: string): Promise<string> {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: { entries: { where: { status: 'CONFIRMED' } } },
        });

        if (!event) throw new NotFoundException('Event not found');

        const sortedEntries = ((event as any).entries as any[]).sort((a, b) => {
            if (a.heat !== b.heat) return (a.heat || 0) - (b.heat || 0);
            return (a.lane || 0) - (b.lane || 0);
        });

        const data = sortedEntries.map((entry) => ({
            'Nr': entry.bib || '',
            'Nazwisko i Imię': entry.athleteName,
            'Klub': '',
            'Seria': entry.heat || '',
            'Tor': entry.lane || '',
        }));

        return Papa.unparse(data, { delimiter: ';' });
    }

    async exportFinishLynxEvt(eventId: string): Promise<string> {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: { entries: { where: { status: 'CONFIRMED' } } },
        });

        if (!event) throw new NotFoundException('Event not found');

        const heats = [...new Set(((event as any).entries as any[]).map(e => e.heat || 1))].sort((a, b) => a - b);
        let evtContent = '';

        for (const heat of heats) {
            const heatEntries = ((event as any).entries as any[])
                .filter(e => (e.heat || 1) === heat)
                .sort((a, b) => (a.lane || 0) - (b.lane || 0));

            evtContent += `${event.code},1,${heat},${event.name},100\n`;

            for (const entry of heatEntries) {
                const parts = entry.athleteName.trim().split(' ');
                const lastName = parts[0] || '';
                const firstName = parts.slice(1).join(' ') || '';
                evtContent += `${entry.bib || ''},${entry.lane || ''},${lastName},${firstName},\n`;
            }
            evtContent += '\n';
        }

        return evtContent;
    }

    async importFederationCsv(meetingId: string, fileBuffer: Buffer): Promise<{ count: number }> {
        const content = iconv.decode(fileBuffer, 'windows-1250');
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: ';' });

        const entries = parsed.data as any[];
        let count = 0;

        for (const row of entries) {
            const athleteName = row['Imię i Nazwisko'] || row['Zawodnik'] || row['Athlete'];
            const eventCode = row['Konkurencja'] || row['KonkurencjaKod'] || row['Event'];
            const bib = row['Nr'] || row['Bib'];

            if (!athleteName || !eventCode) continue;

            let event = await this.prisma.event.findFirst({
                where: { meetingId, code: eventCode },
            });

            if (!event) {
                event = await this.prisma.event.create({
                    data: {
                        name: eventCode,
                        code: eventCode,
                        gender: 'MIX',
                        meetingId,
                    },
                });
            }

            await this.prisma.entry.create({
                data: {
                    athleteName,
                    bib: bib?.toString(),
                    eventId: event.id,
                    status: 'CONFIRMED',
                },
            });
            count++;
        }

        return { count };
    }
}
