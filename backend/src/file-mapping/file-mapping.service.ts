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
        // Try Windows-1250 first as it's common in Polish sport systems
        let content = iconv.decode(fileBuffer, 'windows-1250');

        // Simple heuristic: if decoding results in replacement characters mostly, try UTF-8
        // Or better: just try parsing. If we see specific Polish headers, we proceed.

        let parsed = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: ';' });

        // If parsing failed to find known headers, maybe it was utf-8?
        // (This is a simplification, but often enough)

        const entries = parsed.data as any[];
        let count = 0;

        for (const row of entries) {
            // Support various formats
            let athleteName = row['Imię i Nazwisko'] || row['Zawodnik'] || row['Athlete'];

            // Support separate columns (e.g. Domtel/PZLA format)
            if (!athleteName && row['Imię'] && row['Nazwisko']) {
                athleteName = `${row['Imię']} ${row['Nazwisko']}`;
            }

            // Event mapping
            // 'NazwaPZLA' often contains short code like 'K100m'
            // 'Pełna nazwa' contains full name like '100 metrów kobiet'
            const eventCode = row['NazwaPZLA'] || row['Konkurencja'] || row['KonkurencjaKod'] || row['Event'];
            const eventName = row['Pełna nazwa'] || eventCode; // Fallback to code if name missing

            const bib = row['NrStart'] || row['Nr'] || row['Bib'];
            const club = row['Klub_nazwa'] || row['Klub'] || '';
            const pb = row['PB'] || '';
            const sb = row['SB'] || '';
            const heat = row['Seria'] ? parseInt(row['Seria'], 10) : null;
            const lane = row['Tor'] ? parseInt(row['Tor'], 10) : null;

            if (!athleteName || !eventCode) {
                console.warn('Skipping row due to missing data:', row);
                continue;
            }

            // Find or create event
            let event = await this.prisma.event.findFirst({
                where: { meetingId, code: eventCode },
            });

            if (!event) {
                const gender = this.guessGender(eventCode, eventName);
                const enhancedName = this.enhanceEventNameWithHurdles(eventName || eventCode, eventCode, gender);

                event = await this.prisma.event.create({
                    data: {
                        name: enhancedName,
                        code: eventCode,
                        gender,
                        meetingId,
                    },
                });
            }

            // Create entry with extended Roster fields
            const nameParts = athleteName.trim().split(' ');
            const firstName = row['Imię'] || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
            const lastName = row['Nazwisko'] || (nameParts.length > 0 ? nameParts[0] : '');

            // Parse date of birth if available
            let dateOfBirth = null;
            let yearOfBirth = null;
            if (row['DataUrodzenia'] || row['RokUrodzenia']) {
                if (row['DataUrodzenia']) {
                    const parsed = new Date(row['DataUrodzenia']);
                    if (!isNaN(parsed.getTime())) {
                        dateOfBirth = parsed;
                        yearOfBirth = parsed.getFullYear();
                    }
                }
                if (!yearOfBirth && row['RokUrodzenia']) {
                    yearOfBirth = parseInt(row['RokUrodzenia'], 10);
                }
            }

            await this.prisma.entry.create({
                data: {
                    athleteName,
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    bib: bib?.toString(),
                    club: club,
                    pb: pb,
                    sb: sb,
                    heat: heat || undefined,
                    lane: lane || undefined,
                    eventId: event.id,
                    status: 'CONFIRMED',
                    countryCode: row['KrajKod'] || 'POL',
                    dateOfBirth: dateOfBirth || undefined,
                    yearOfBirth: yearOfBirth || undefined,
                    gender: event.gender === 'MIX' ? undefined : event.gender,
                },
            });
            count++;
        }

        return { count };
    }

    private guessGender(code: string, name: string): 'M' | 'F' | 'MIX' {
        const text = (code + ' ' + name).toUpperCase();
        if (text.includes('KOBIET') || text.startsWith('K') || text.includes('WOMEN') || text.includes('DZIEWCZ')) return 'F';
        if (text.includes('MĘŻCZYZN') || text.startsWith('M') || text.includes('MEN') || text.includes('CHŁOP')) return 'M';
        return 'MIX';
    }

    private enhanceEventNameWithHurdles(name: string, code: string, gender: string): string {
        const text = (name + ' ' + code).toUpperCase();
        if (!text.match(/(PPŁ|PŁ|HURDLES)/)) return name;
        if (text.match(/\d+(\.\d+)?\/\d+(\.\d+)?/)) return name; // Already has details (e.g. 76.2/8.00)

        // Detect category
        const isU16 = text.includes('U16') || text.includes('MŁODZIK');
        const isU18 = text.includes('U18') || text.includes('JUNIOR MŁ');
        const isU20 = text.includes('U20') || text.includes('JUNIOR');
        const isSen = !isU16 && !isU18 && !isU20; // Only if explicit categories absent? Or assume Sen.

        // Detect Distance
        const distMatch = text.match(/(\d+)\s*(M|METR)/); // e.g. 60 m, 60metr
        const dist = distMatch ? parseInt(distMatch[1]) : 0;

        if (dist === 0) return name;

        let suffix = '';

        if (gender === 'F') {
            if (dist === 60) {
                if (isU16) suffix = '(76.2/8.00)';
                else if (isU18) suffix = '(76.2/8.50)';
                else suffix = '(83.8/8.50)'; // U20, Sen
            } else if (dist === 80 && isU16) {
                suffix = '(76.2/8.00)';
            } else if (dist === 100) {
                if (isU18) suffix = '(76.2/8.50)';
                else suffix = '(83.8/8.50)'; // U20, Sen
            } else if (dist === 300 && isU16) {
                suffix = '(76.2)';
            } else if (dist === 400) {
                suffix = '(76.2)';
            }
        } else if (gender === 'M') {
            if (dist === 60) {
                if (isU16) suffix = '(91.4/8.90)';
                else if (isU18) suffix = '(91.4/9.14)';
                else if (isU20) suffix = '(99.1/9.14)';
                else suffix = '(106.7/9.14)'; // Sen
            } else if (dist === 110) {
                if (isU16) suffix = '(91.4/9.14)';
                else if (isU18) suffix = '(91.4/9.14)';
                else if (isU20) suffix = '(99.1/9.14)';
                else suffix = '(106.7/9.14)'; // Sen
            } else if (dist === 300 && isU16) {
                suffix = '(83.8)'; // ? Check rules
            } else if (dist === 400) {
                if (isU18) suffix = '(84.0)';
                else suffix = '(91.4)';
            }
        }

        return suffix ? `${name} ${suffix}` : name;
    }
}
