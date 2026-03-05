import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntriesService } from '../entries/entries.service';
import { RosterEntryDto, RosterResultDto } from './roster.dto';
import * as Papa from 'papaparse';
import { Readable } from 'stream';
import { EntryStatus } from '@prisma/client';

@Injectable()
export class RosterService {
  constructor(
    private prisma: PrismaService,
    private entriesService: EntriesService,
  ) {}

  /**
   * Import entries from Roster Athletics CSV format
   */
  async importEntriesFromCsv(
    meetingId: string,
    csvContent: string,
  ): Promise<{ imported: number; updated: number }> {
    const entries = await this.parseRosterCsv<RosterEntryDto>(csvContent);

    if (!entries || entries.length === 0) {
      throw new BadRequestException(
        'Brak danych do zaimportowania lub nieprawidłowy format pliku CSV.',
      );
    }

    let imported = 0;
    let updated = 0;

    const relayGroups = new Map<string, RosterEntryDto[]>();

    const isRelay = (code: string, name: string) => {
      const combined = ((code || '') + (name || '')).toUpperCase();
      return combined.includes('4X') || combined.includes('SZTAFETA');
    };

    for (const row of entries) {
      try {
        // Find or create event
        const event = await this.findOrCreateEvent(meetingId, row);

        if (isRelay(row.eventCode || '', event.name || '')) {
          // Group key: EventID + Club + (Heat/Lane/Group ?)
          // If Roster provides one entryId per team, we could use that, but usually it's one per athlete?
          // Safe bet: Group by Event + Club + Heat + Lane
          const club =
            (row as any).clubName || (row as any).shortClubName || 'Unattached';
          const heat = row.heat || (row as any).eventGroup || '0';
          const lane = row.lane || '0';
          const key = `${event.id}|${club}|${heat}|${lane}`;

          if (!relayGroups.has(key)) {
            relayGroups.set(key, []);
          }
          relayGroups.get(key)!.push(row);
          continue;
        }

        // Check if entry already exists (strictly by entryId for Roster)
        const existingEntry = await this.prisma.entry.findFirst({
          where: {
            eventId: event.id,
            entryId: row.entryId?.toString(),
          },
        });

        const entryData = {
          athleteName:
            (row as any).fullName ||
            `${(row as any).firstName || ''} ${(row as any).lastName || ''}`.trim(),
          firstName: (row as any).firstName,
          middleName: (row as any).middleName,
          lastName: (row as any).lastName,
          bib: (row as any).bibNumber?.toString(),
          club: (row as any).clubName || (row as any).shortClubName,
          countryCode: (row as any).countryCode || 'POL',
          birthDate: (row as any).dateOfBirth
            ? new Date((row as any).dateOfBirth)
            : null,
          yearOfBirth: (row as any).yearOfBirth
            ? parseInt((row as any).yearOfBirth.toString(), 10)
            : null,
          gender: this.mapGender((row as any).gender || event.gender),
          tilastopajaId: (row as any).tilastopajaId?.toString(),
          entryId: (row as any).entryId?.toString(),
          startListId: (row as any).startListId?.toString(),
          pb: (row as any).personalBest,
          sb: (row as any).seasonBest,
          seedingResult: (row as any).seedingResult,
          lane: row.lane ? parseInt(row.lane.toString(), 10) : null,
          heat:
            row.heat || (row as any).eventGroup
              ? parseInt((row.heat || (row as any).eventGroup).toString(), 10)
              : null,
          eventId: event.id,
          status: EntryStatus.CONFIRMED,
        };

        if (existingEntry) {
          const athlete = await this.entriesService.findOrCreateAthlete(
            entryData as any,
          );
          await this.prisma.entry.update({
            where: { id: existingEntry.id },
            data: {
              ...entryData,
              athleteId: athlete.id,
              dateOfBirth: entryData.birthDate,
            },
          });
          updated++;
        } else {
          await this.entriesService.create(entryData as any);
          imported++;
        }
      } catch (error) {
        console.error(`Error importing entry:`, error);
      }
    }

    // Process Relay Groups
    for (const [key, members] of relayGroups) {
      try {
        if (members.length === 0) continue;
        const firstRow = members[0];

        // We need to resolve the event again or store it.
        // Since we used event.id in key, we can find event by just using findUnique or re-resolving using findOrCreateEvent helper (safer to re-fetch/resolve)
        // But efficient way: extract meetingId from scope and create DTO.

        const event = await this.findOrCreateEvent(meetingId, firstRow);

        const club =
          (firstRow as any).clubName ||
          (firstRow as any).shortClubName ||
          'Sztafeta';

        // Determine Entry ID for the team.
        // We can use the first member's entryId or combine them?
        // Roster exports EntryId column.
        const teamEntryId = firstRow.entryId?.toString();

        const existingEntry = await this.prisma.entry.findFirst({
          where: {
            eventId: event.id,
            entryId: teamEntryId, // Try to match by first member's ID? Or maybe search by Name?
          },
        });

        // Squad
        const relaySquad = members.map((m) => ({
          firstName: (m as any).firstName,
          lastName: (m as any).lastName,
          bib: (m as any).bibNumber?.toString(),
          yearOfBirth: (m as any).yearOfBirth,
        }));

        const entryData = {
          athleteName: club, // Team Name
          club: club,
          countryCode: (firstRow as any).countryCode || 'POL',
          gender: this.mapGender((firstRow as any).gender || event.gender),
          entryId: teamEntryId,
          startListId: firstRow.startListId?.toString(),
          lane: firstRow.lane ? parseInt(firstRow.lane.toString(), 10) : null,
          heat:
            firstRow.heat || (firstRow as any).eventGroup
              ? parseInt(
                  (firstRow.heat || (firstRow as any).eventGroup).toString(),
                  10,
                )
              : null,
          eventId: event.id,
          status: EntryStatus.CONFIRMED,
          relaySquad: JSON.stringify(relaySquad),
        };

        if (existingEntry) {
          // Update
          await this.prisma.entry.update({
            where: { id: existingEntry.id },
            data: {
              ...entryData,
              // Ensure we don't overwrite athleteId with individual one, but findOrCreateAthlete works with name=Club so it's fine
            },
          });
          updated++;
        } else {
          await this.entriesService.create(entryData as any);
          imported++;
        }
      } catch (e) {
        console.error('Error processing relay group', e);
      }
    }

    return { imported, updated };
  }

  /**
   * Import results from Roster Athletics results CSV
   */
  async importResultsFromCsv(
    meetingId: string,
    csvContent: string,
  ): Promise<{ imported: number; updated: number }> {
    const results = await this.parseRosterCsv<RosterResultDto>(csvContent);

    if (!results || results.length === 0) {
      throw new BadRequestException('Brak danych wyników do zaimportowania.');
    }

    let imported = 0;
    let updated = 0;

    for (const row of results) {
      try {
        // Find entry by entryId (most reliable for unique Roster records)
        const entry = await this.prisma.entry.findFirst({
          where: {
            entryId: row.entryId?.toString(),
          },
        });

        if (!entry) {
          continue;
        }

        const resultData = {
          place: row.place ? parseInt(row.place.toString(), 10) : null,
          placeGender: row.placeGender
            ? parseInt(row.placeGender.toString(), 10)
            : null,
          time: row.result,
          resultRounded: row.resultRounded,
          windReading: row.windReading,
          wind: row.windReading
            ? parseFloat(row.windReading.replace(',', '.'))
            : null,
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
        console.error(`Error importing result:`, error);
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

    const rows: any[] = [];

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

    const rows: any[] = [];

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
          lane: (entry.lane as any) ?? undefined,
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
   * Parse Roster CSV using PapaParse
   */
  private parseRosterCsv<T>(csvContent: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => this.mapHeader(header),
        complete: (results) => resolve(results.data as T[]),
        error: (error: Error) => reject(error),
      });
    });
  }

  /**
   * Detects format and maps headers to camelCase
   */
  private mapHeader(header: string): string {
    const clean = header.replace(/^\uFEFF/, '').trim();

    // Roster Athletics Mapping
    const rosterMapping: Record<string, string> = {
      PZLAEventCode: 'pzlaEventCode',
      PZLAEventCodeNum: 'pzlaEventCodeNum',
      UKAEventCode: 'ukaEventCode',
      MeetingId: 'meetingId',
      EntryId: 'entryId',
      StartListId: 'startListId',
      FullName: 'fullName',
      FirstName: 'firstName',
      MiddleName: 'middleName',
      LastName: 'lastName',
      Gender: 'gender',
      DateOfBirth: 'dateOfBirth',
      YearOfBirth: 'yearOfBirth',
      CountryCode: 'countryCode',
      ClubName: 'clubName',
      ShortClubName: 'shortClubName',
      BibNumber: 'bibNumber',
      Lane: 'lane',
      Title: 'title',
      EventCode: 'eventCode',
      EventStart: 'eventStart',
      EventStage: 'eventStage',
      AgeGroup: 'ageGroup',
      PersonalBest: 'personalBest',
      SeasonBest: 'seasonBest',
      SeedingResult: 'seedingResult',
      Place: 'place',
      PlaceGender: 'placeGender',
      Result: 'result',
      ResultRounded: 'resultRounded',
      WindReading: 'windReading',
      EventName: 'eventName',
      EventGroup: 'eventGroup',
      Round1Result: 'round1Result',
      Round2Result: 'round2Result',
      Round3Result: 'round3Result',
      Round4Result: 'round4Result',
      Round5Result: 'round5Result',
      Round6Result: 'round6Result',
    };

    // DomTel / PZLA Mapping (Polish Names)
    const domtelMapping: Record<string, string> = {
      NrKonkur: 'eventCode',
      NazwaPZLA: 'pzlaEventCode',
      'Pełna nazwa': 'eventName',
      'Pelna nazwa': 'eventName',
      'Pełna nazwa ': 'eventName', // variant with space
      NrStart: 'bibNumber',
      Nazwisko: 'lastName',
      Imie: 'firstName',
      Imię: 'firstName',
      DataUr: 'dateOfBirth',
      Klub: 'clubName',
      Płeć: 'gender',
      Plec: 'gender',
      Kategoria: 'ageGroup',
      SB: 'seasonBest',
      PB: 'personalBest',
      Seria: 'heat',
      Tor: 'lane',
      Miejsce: 'place',
      Wynik: 'result',
      Wiatr: 'windReading',
      Runda: 'eventStage',
    };

    if (rosterMapping[clean]) return rosterMapping[clean];
    if (domtelMapping[clean]) return domtelMapping[clean];

    return clean.charAt(0).toLowerCase() + clean.slice(1);
  }

  private mapGender(gender?: string): string {
    if (!gender) return 'MIX';
    const g = gender.toLowerCase();
    if (g === 'male' || g === 'm' || g === 'mężczyzna' || g === 'mezczyzna')
      return 'M';
    if (g === 'female' || g === 'f' || g === 'kobieta' || g === 'k') return 'K';
    return 'MIX';
  }

  private generateCsv<T extends Record<string, any>>(data: T[]): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const displayHeaders = headers.map((h) => {
      if (h === 'pzlaEventCode') return 'PZLAEventCode';
      if (h === 'ukaEventCode') return 'UKAEventCode';
      return h.charAt(0).toUpperCase() + h.slice(1);
    });
    return Papa.unparse({
      fields: displayHeaders,
      data: data.map((row) => Object.values(row)),
    });
  }

  private async findOrCreateEvent(meetingId: string, row: RosterEntryDto) {
    const startListId = row.startListId?.toString();
    const gender = this.mapGender(row.gender);
    const ageGroup = row.ageGroup?.toString() || null;
    const stage = row.eventStage || 'Final';

    // Construct descriptive name
    // prioritized DomTel 'eventName' (Pełna nazwa) if available and descriptive
    const agePrefix = ageGroup ? `U${ageGroup}` : '';
    const baseName =
      row.eventName ||
      row.pzlaEventCode ||
      row.eventStart ||
      `Konkurencja ${row.eventCode}`;

    let eventName = baseName;
    const detailSuffixes: string[] = [];

    // Check for age group redundancy
    if (agePrefix && !baseName.includes(agePrefix)) {
      detailSuffixes.push(agePrefix);
    }

    // Add gender to name if it's not a mixed event and not already in name
    const genderLabel =
      gender === 'M' ? 'Mężczyźni' : gender === 'K' ? 'Kobiety' : 'Open';
    if (
      gender !== 'MIX' &&
      !baseName.toLowerCase().includes(genderLabel.toLowerCase()) &&
      !baseName.toLowerCase().includes(gender.toLowerCase())
    ) {
      detailSuffixes.push(genderLabel);
    }

    if (detailSuffixes.length > 0) {
      eventName = `${baseName} (${detailSuffixes.join(', ')})`;
    }

    // 1. Try to find by StartListId mapping (via entries)
    let event = null;
    if (startListId) {
      event = await this.prisma.event.findFirst({
        where: {
          meetingId,
          entries: { some: { startListId: startListId } },
        },
      });
    }

    // 2. Strict fallback (must match gender/age/stage/code)
    // We DO NOT ignore gender here anymore, as Roster uses different StartListIds for genders
    if (!event) {
      event = await this.prisma.event.findFirst({
        where: {
          meetingId,
          gender: gender,
          stage,
          eventCode: row.eventCode || undefined,
          ageGroup: ageGroup,
        },
      });
    }

    if (!event) {
      event = await this.prisma.event.create({
        data: {
          name: eventName,
          code: row.eventCode || 'UNKNOWN',
          eventCode: row.eventCode,
          gender: gender,
          ageGroup: ageGroup,
          stage: stage,
          startTime: row.eventStart ? new Date(row.eventStart) : null,
          meetingId,
        },
      });
    } else {
      // Update name and handle possible MIX transition
      if (event.gender !== 'MIX' && event.gender !== gender) {
        // If the same event (found via StartListId) now contains a different gender, mark as MIX
        await this.prisma.event.update({
          where: { id: event.id },
          data: { gender: 'MIX' },
        });
      }

      const updateData: any = {};

      if (
        event.name.startsWith('Event ') ||
        event.name === 'Unknown Event' ||
        /^\d{4}-\d{2}/.test(event.name)
      ) {
        updateData.name = eventName;
      }

      // Auto-update startTime if provided in CSV and not set or different
      if (row.eventStart) {
        const csvStartTime = new Date(row.eventStart);
        if (
          !event.startTime ||
          event.startTime.getTime() !== csvStartTime.getTime()
        ) {
          updateData.startTime = csvStartTime;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: updateData,
        });
      }
    }

    return event;
  }

  private findBestResult(rounds: (string | undefined)[]): string | null {
    const validResults = rounds
      .filter((r): r is string => !!r && r !== 'X' && r !== '-' && r !== 'O')
      .map((r) => parseFloat(r.replace(',', '.')))
      .filter((r) => !isNaN(r));

    return validResults.length > 0
      ? Math.max(...validResults).toString()
      : null;
  }
}
