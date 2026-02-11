import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RosterEntryDto, RosterResultDto } from './roster.dto';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

@Injectable()
export class RosterService {
    constructor(private prisma: PrismaService) { }

    /**
     * Import entries from Roster Athletics CSV format
     */
    async importEntriesFromCsv(meetingId: string, csvContent: string): Promise<{ imported: number; updated: number }> {
        const entries: RosterEntryDto[] = await this.parseCsv(csvContent);

        let imported = 0;
        let updated = 0;

        for (const row of entries) {
            try {
                // Find or create event
                const event = await this.findOrCreateEvent(meetingId, row);

                // Check if entry already exists (by entryId or startListId)
                const existingEntry = await this.prisma.entry.findFirst({
                    where: {
                        OR: [
                            { entryId: row.entryId, eventId: event.id },
                            { startListId: row.startListId, eventId: event.id },
                        ],
                    },
                });

                const entryData = {
                    athleteName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
                    firstName: row.firstName,
                    middleName: row.middleName,
                    lastName: row.lastName,
                    bib: row.bibNumber,
                    club: row.clubName || row.shortClubName,
                    countryCode: row.countryCode,
                    dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
                    yearOfBirth: row.yearOfBirth,
                    gender: row.gender,
                    tilastopajaId: row.tilastopajaId,
                    entryId: row.entryId,
                    startListId: row.startListId,
                    pb: row.personalBest,
                    sb: row.seasonBest,
                    seedingResult: row.seedingResult,
                    lane: row.lane,
                    eventId: event.id,
                };

                if (existingEntry) {
                    await this.prisma.entry.update({
                        where: { id: existingEntry.id },
                        data: entryData,
                    });
                    updated++;
                } else {
                    await this.prisma.entry.create({
                        data: entryData,
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`Error importing entry ${row.fullName}:`, error);
                // Continue with next entry
            }
        }

        return { imported, updated };
    }

    /**
     * Import results from Roster Athletics results CSV
     */
    async importResultsFromCsv(meetingId: string, csvContent: string): Promise<{ imported: number; updated: number }> {
        const results: RosterResultDto[] = await this.parseCsv(csvContent);

        let imported = 0;
        let updated = 0;

        for (const row of results) {
            try {
                // Find entry by entryId or startListId
                const entry = await this.prisma.entry.findFirst({
                    where: {
                        OR: [
                            { entryId: row.entryId },
                            { startListId: row.startListId },
                        ],
                    },
                });

                if (!entry) {
                    console.warn(`Entry not found for result: ${row.fullName}`);
                    continue;
                }

                const resultData = {
                    place: row.place,
                    placeGender: row.placeGender,
                    time: row.result,
                    resultRounded: row.resultRounded,
                    windReading: row.windReading,
                    wind: row.windReading ? parseFloat(row.windReading) : null,
                    round1Result: row.round1Result,
                    round2Result: row.round2Result,
                    round3Result: row.round3Result,
                    round4Result: row.round4Result,
                    round5Result: row.round5Result,
                    round6Result: row.round6Result,
                    bestResult: this.findBestResult([
                        row.round1Result,
                        row.round2Result,
                        row.round3Result,
                        row.round4Result,
                        row.round5Result,
                        row.round6Result,
                    ]),
                    entryId: entry.id,
                };

                const existingResult = await this.prisma.result.findUnique({
                    where: { entryId: entry.id },
                });

                if (existingResult) {
                    await this.prisma.result.update({
                        where: { id: existingResult.id },
                        data: resultData,
                    });
                    updated++;
                } else {
                    await this.prisma.result.create({
                        data: resultData,
                    });
                    imported++;
                }
            } catch (error) {
                console.error(`Error importing result for ${row.fullName}:`, error);
            }
        }

        return { imported, updated };
    }

    /**
     * Export entries to Roster Athletics CSV format
     */
    async exportEntriesToCsv(meetingId: string): Promise<string> {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                events: {
                    include: {
                        entries: true,
                    },
                },
            },
        });

        if (!meeting) {
            throw new BadRequestException('Meeting not found');
        }

        const rows: RosterEntryDto[] = [];

        for (const event of meeting.events) {
            for (const entry of event.entries) {
                rows.push({
                    meetingId: meeting.id,
                    entryId: entry.entryId ?? undefined,
                    startListId: entry.startListId ?? undefined,
                    eventStart: event.startTime?.toISOString(),
                    eventCode: event.eventCode ?? undefined,
                    eventStage: event.stage ?? undefined,
                    ageGroup: event.ageGroup ?? undefined,
                    fullName: entry.athleteName,
                    firstName: entry.firstName ?? undefined,
                    middleName: entry.middleName ?? undefined,
                    lastName: entry.lastName ?? undefined,
                    gender: entry.gender || event.gender,
                    countryCode: entry.countryCode ?? undefined,
                    dateOfBirth: entry.dateOfBirth?.toISOString(),
                    yearOfBirth: entry.yearOfBirth ?? undefined,
                    tilastopajaId: entry.tilastopajaId ?? undefined,
                    clubName: entry.club ?? undefined,
                    bibNumber: entry.bib ?? undefined,
                    lane: entry.lane ?? undefined,
                    personalBest: entry.pb ?? undefined,
                    seasonBest: entry.sb ?? undefined,
                    seedingResult: entry.seedingResult ?? undefined,
                });
            }
        }

        return this.generateCsv(rows);
    }

    /**
     * Export results to Roster Athletics CSV format
     */
    async exportResultsToCsv(meetingId: string): Promise<string> {
        const meeting = await this.prisma.meeting.findUnique({
            where: { id: meetingId },
            include: {
                events: {
                    include: {
                        entries: {
                            include: {
                                result: true,
                            },
                        },
                    },
                },
            },
        });

        if (!meeting) {
            throw new BadRequestException('Meeting not found');
        }

        const rows: RosterResultDto[] = [];

        for (const event of meeting.events) {
            for (const entry of event.entries) {
                const result = entry.result;

                rows.push({
                    meetingId: meeting.id,
                    entryId: entry.entryId ?? undefined,
                    startListId: entry.startListId ?? undefined,
                    eventStart: event.startTime?.toISOString(),
                    eventCode: event.eventCode ?? undefined,
                    eventStage: event.stage ?? undefined,
                    ageGroup: event.ageGroup ?? undefined,
                    fullName: entry.athleteName,
                    firstName: entry.firstName ?? undefined,
                    middleName: entry.middleName ?? undefined,
                    lastName: entry.lastName ?? undefined,
                    gender: entry.gender || event.gender,
                    countryCode: entry.countryCode ?? undefined,
                    dateOfBirth: entry.dateOfBirth?.toISOString(),
                    yearOfBirth: entry.yearOfBirth ?? undefined,
                    tilastopajaId: entry.tilastopajaId ?? undefined,
                    clubName: entry.club ?? undefined,
                    bibNumber: entry.bib ?? undefined,
                    lane: entry.lane ?? undefined,
                    personalBest: entry.pb ?? undefined,
                    seasonBest: entry.sb ?? undefined,
                    seedingResult: entry.seedingResult ?? undefined,
                    // Results
                    place: result?.place ?? undefined,
                    placeGender: result?.placeGender ?? undefined,
                    result: result?.time ?? undefined,
                    resultRounded: result?.resultRounded ?? undefined,
                    windReading: result?.windReading ?? undefined,
                    round1Result: result?.round1Result ?? undefined,
                    round2Result: result?.round2Result ?? undefined,
                    round3Result: result?.round3Result ?? undefined,
                    round4Result: result?.round4Result ?? undefined,
                    round5Result: result?.round5Result ?? undefined,
                    round6Result: result?.round6Result ?? undefined,
                });
            }
        }

        return this.generateCsv(rows);
    }

    // --- HELPER METHODS ---

    /**
     * Parse CSV content to array of objects
     */
    private parseCsv<T>(csvContent: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const results: T[] = [];
            const stream = Readable.from([csvContent]);

            stream
                .pipe(csvParser())
                .on('data', (data: any) => results.push(data as T))
                .on('end', () => resolve(results))
                .on('error', (error: Error) => reject(error));
        });
    }

    /**
     * Generate CSV from array of objects (manual implementation)
     */
    private generateCsv<T extends Record<string, any>>(data: T[]): string {
        if (!data.length) {
            return '';
        }

        const headers = Object.keys(data[0]);
        const csvLines: string[] = [];

        // Add header row
        csvLines.push(headers.join(','));

        // Add data rows
        for (const row of data) {
            const values = headers.map((header) => {
                const value = row[header];
                if (value === undefined || value === null) {
                    return '';
                }
                // Escape quotes and wrap in quotes if contains comma or quote
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            });
            csvLines.push(values.join(','));
        }

        return csvLines.join('\n');
    }

    /**
     * Find or create event based on Roster CSV data
     */
    private async findOrCreateEvent(meetingId: string, row: RosterEntryDto) {
        // Try to find existing event by code or name
        let event = await this.prisma.event.findFirst({
            where: {
                meetingId,
                OR: [
                    { eventCode: row.eventCode },
                    { name: row.eventStart }, // Fallback to event name
                ],
            },
        });

        if (!event) {
            // Create new event
            event = await this.prisma.event.create({
                data: {
                    name: row.eventStart || 'Unknown Event',
                    code: row.eventCode || 'UNKNOWN',
                    eventCode: row.eventCode,
                    gender: row.gender || 'MIX',
                    ageGroup: row.ageGroup,
                    stage: row.eventStage || 'Final',
                    meetingId,
                },
            });
        }

        return event;
    }

    /**
     * Find best result from rounds (for field events)
     */
    private findBestResult(rounds: (string | undefined)[]): string | null {
        const validResults = rounds
            .filter((r): r is string => !!r && r !== 'X' && r !== '-' && r !== 'O')
            .map((r) => parseFloat(r))
            .filter((r) => !isNaN(r));

        if (!validResults.length) {
            return null;
        }

        return Math.max(...validResults).toString();
    }
}
