import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntriesService } from '../entries/entries.service';
import * as Papa from 'papaparse';
import * as iconv from 'iconv-lite';

@Injectable()
export class FileMappingService {
    constructor(
        private prisma: PrismaService,
        private entriesService: EntriesService
    ) { }

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
                const lastName = entry.lastName || entry.athleteName.trim().split(' ').slice(1).join(' ') || entry.athleteName;
                const firstName = entry.firstName || entry.athleteName.trim().split(' ')[0] || '';
                evtContent += `${entry.bib || ''},${entry.lane || ''},${lastName},${firstName},\n`;
            }
            evtContent += '\n';
        }

        return evtContent;
    }

    async importFederationCsv(meetingId: string, fileBuffer: Buffer): Promise<{ count: number }> {
        // Try Windows-1250 first as it's common in Polish sport systems
        let content = iconv.decode(fileBuffer, 'windows-1250');
        console.log('Importing Federation CSV, length:', content.length);

        let parsed = Papa.parse(content, { header: true, skipEmptyLines: true, delimiter: ';' });

        const entries = parsed.data as any[];
        console.log('Parsed entries count:', entries.length);

        let count = 0;

        const relayGroups = new Map<string, any[]>();

        const isRelay = (code: string, name: string) => {
            const combined = ((code || '') + ' ' + (name || '')).toUpperCase();
            // Robust check: 4x, 4 x, 4*, Sztafeta
            const isRelay = /4\s*[xX*]\s*\d+/.test(combined) || combined.includes('SZTAFETA') || combined.includes('RELAY');
            return isRelay;
        };

        // 1. First pass: Handle individuals and grouping relays
        for (const row of entries) {
            // Support various formats
            let athleteName = row['Imię i Nazwisko'] || row['Zawodnik'] || row['Athlete'];

            // Support separate columns (e.g. Domtel/PZLA format)
            if (!athleteName && row['Imię'] && row['Nazwisko']) {
                athleteName = `${row['Imię']} ${row['Nazwisko']}`;
            }

            // Event mapping — use 'Sztafeta' column to detect relay code in PZLA format
            const rawEventCode = row['NazwaPZLA'] || row['Konkurencja'] || row['KonkurencjaKod'] || row['Event'];
            const eventCode = (rawEventCode || '').trim();
            const eventName = (row['Pełna nazwa'] || eventCode || '').trim();
            const sztafetaCol = (row['Sztafeta'] || '').trim(); // PZLA column indicating relay membership

            const bib = (row['NrStart'] || row['Nr'] || row['Bib'] || '').trim();
            const club = (row['Klub_nazwa'] || row['Klub'] || '').trim();
            const pb = row['PB'] || '';
            const sb = row['SB'] || '';
            const heat = row['Seria'] ? parseInt(row['Seria'], 10) : null;
            const lane = row['Tor'] ? parseInt(row['Tor'], 10) : null;

            if (!eventCode) {
                continue;
            }

            // Detect relay: either by event code/name pattern OR by 'Sztafeta' column
            const rowIsRelay = isRelay(eventCode, eventName) || (sztafetaCol.length > 0 && isRelay(sztafetaCol, ''));

            if (rowIsRelay) {
                // Use Sztafeta col as the canonical relay event code if available, else eventCode
                const relayEventCode = sztafetaCol || eventCode;

                // Group by relay event code + club (ignore heat/lane for relays — one team per club per event)
                const key = `${relayEventCode}|${club}`;
                if (!relayGroups.has(key)) {
                    relayGroups.set(key, []);
                }
                const group = relayGroups.get(key)!;

                // Parse member details
                const firstName = (row['Imię'] || '').trim();
                const lastName = (row['Nazwisko'] || '').trim();

                // Parse birth year from DataUr (PZLA format) or DataUrodzenia or RokUrodzenia
                let yearOfBirth: number | null = null;
                const birthDateStr = row['DataUr'] || row['DataUrodzenia'];
                if (birthDateStr) {
                    const d = new Date(birthDateStr);
                    if (!isNaN(d.getTime())) yearOfBirth = d.getFullYear();
                }
                if (!yearOfBirth && row['RokUrodzenia']) {
                    yearOfBirth = parseInt(row['RokUrodzenia'], 10);
                }

                // Only add members that have actual name data
                if (firstName || lastName) {
                    group.push({
                        firstName,
                        lastName,
                        bib,
                        yearOfBirth
                    });
                }

                // Store raw row on last member for metadata extraction later
                if (group.length > 0) {
                    group[group.length - 1].rawRow = row;
                }

                continue;
            }

            if (!athleteName) {
                console.warn('Skipping individual row due to missing name:', row);
                continue;
            }

            // Individual entry processing
            if (!athleteName) {
                continue;
            }

            // Find or create event
            let event = await this.findOrCreateEventByCode(meetingId, eventCode, eventName);

            const firstName = (row['Imię'] || '').trim();
            const lastName = (row['Nazwisko'] || '').trim();

            let dateOfBirth = null;
            let yearOfBirth = null;
            const birthDateStr = row['DataUr'] || row['DataUrodzenia'];
            if (birthDateStr) {
                const parsed = new Date(birthDateStr);
                if (!isNaN(parsed.getTime())) {
                    dateOfBirth = parsed;
                    yearOfBirth = parsed.getFullYear();
                }
            }
            if (!yearOfBirth && row['RokUrodzenia']) {
                yearOfBirth = parseInt(row['RokUrodzenia'], 10);
            }

            await this.entriesService.create({
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
                birthDate: dateOfBirth || undefined,
                yearOfBirth: yearOfBirth || undefined,
                gender: event.gender === 'MIX' ? undefined : event.gender,
            });
            count++;
        }

        // 2. Process Relay Groups
        console.log(`Relay groups found: ${relayGroups.size}`);
        for (const [key, members] of relayGroups) {
            if (members.length === 0) continue;

            // Extract common data from a member with rawRow
            const memberWithRow = members.find(m => m.rawRow) || members[0];
            const row = memberWithRow.rawRow || {};

            // Use the relay event code from the key (first part before |)
            const relayEventCode = key.split('|')[0].trim();
            const eventName = (row['Pełna nazwa'] || relayEventCode || '').trim();
            const club = (row['Klub_nazwa'] || row['Klub'] || 'Sztafeta').trim();
            const heat = row['Seria'] ? parseInt(row['Seria'], 10) : null;
            const lane = row['Tor'] ? parseInt(row['Tor'], 10) : null;

            // Find or create event using normalized code
            let event = await this.findOrCreateEventByCode(meetingId, relayEventCode, eventName);

            // Build squad JSON — only members with actual names
            const relaySquad = members
                .filter(m => m.firstName || m.lastName)
                .map(m => ({
                    firstName: m.firstName,
                    lastName: m.lastName,
                    bib: m.bib,
                    yearOfBirth: m.yearOfBirth
                }));

            console.log(`Creating relay entry: club=${club}, event=${event.name} (${event.code}), members=${relaySquad.length}`);
            console.log('  Squad:', JSON.stringify(relaySquad));

            // Create Entry for the Team
            await this.entriesService.create({
                athleteName: club,
                club: club,
                heat: heat || undefined,
                lane: lane || undefined,
                eventId: event.id,
                status: 'CONFIRMED',
                countryCode: row['KrajKod'] || 'POL',
                gender: event.gender === 'MIX' ? undefined : event.gender,
                relaySquad: JSON.stringify(relaySquad)
            });
            count++;
        }

        return { count };
    }
    private async findOrCreateEventByCode(meetingId: string, eventCode: string, eventName: string) {
        const code = eventCode.trim();

        let event = await this.prisma.event.findFirst({
            where: { meetingId, code },
        });

        if (!event) {
            const gender = this.guessGender(code, eventName);
            const enhancedName = this.enhanceEventNameWithHurdles(eventName || code, code, gender);

            event = await this.prisma.event.create({
                data: {
                    name: enhancedName,
                    code,
                    gender,
                    meetingId,
                },
            });
        }

        return event;
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
