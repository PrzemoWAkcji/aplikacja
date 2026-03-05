import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { EntriesService } from '../entries/entries.service';
import { firstValueFrom } from 'rxjs';
import { Agent as HttpsAgent } from 'https';
import * as Papa from 'papaparse';
import { decodeTextBuffer } from '../utils/text-decoder.util';

type StarterMeeting = {
  id: string;
  name: string;
  location: string;
  dateLabel: string;
  label: string;
};

@Injectable()
export class FileMappingService {
  private readonly logger = new Logger(FileMappingService.name);

  constructor(
    private prisma: PrismaService,
    private entriesService: EntriesService,
    private readonly httpService: HttpService,
  ) {}

  async fetchStarterMeetings(
    email: string,
  ): Promise<{ meetings: StarterMeeting[] }> {
    if (!email?.trim()) {
      throw new BadRequestException('Email is required');
    }

    const encodedEmail = encodeURIComponent(email.trim());
    const meetingListUrls = [
      `http://exprt.domtel-sport.pl/ImprezaCSV_2.php?mail=${encodedEmail}&wersja=5`,
      `http://exprt.domtel-sport.pl/ImprezaCSV_2.php?mail=${encodedEmail}`,
      `https://exprt.domtel-sport.pl/ImprezaCSV_2.php?mail=${encodedEmail}&wersja=5`,
      `https://exprt.domtel-sport.pl/ImprezaCSV_2.php?mail=${encodedEmail}`,
    ];

    const errors: string[] = [];

    for (const url of meetingListUrls) {
      try {
        const buffer = await this.fetchCsvBuffer(url);
        const content = this.decodeCsvContent(buffer);
        const meetings = this.parseStarterMeetingList(content);

        if (meetings.length > 0) {
          return { meetings };
        }

        if (content.trim().length > 0) {
          this.logger.warn(
            `Starter meeting list parsed but returned 0 rows: ${url}`,
          );
          return { meetings: [] };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown starter list error';
        errors.push(`${url} -> ${message}`);
      }
    }

    throw new BadGatewayException(
      `Unable to fetch meeting list from Starter service. ${errors.join(' | ')}`,
    );
  }

  async importStarterMeeting(
    meetingId: string,
    externalMeetingId: string,
  ): Promise<{ count: number; sourceUrl: string }> {
    const remoteId = externalMeetingId.trim();
    if (!remoteId) {
      throw new BadRequestException('externalMeetingId is required');
    }

    const importUrls = [
      `http://exprt.domtel-sport.pl/ZawodyCSV.php?LP=${encodeURIComponent(remoteId)}&wersja=5`,
      `http://exprt.domtel-sport.pl/ZawodyCSV.php?LP=${encodeURIComponent(remoteId)}`,
      `https://domtel-sport.pl/zgloszenia/export1/ConfirmationCSV.php?LP=${encodeURIComponent(remoteId)}`,
      `http://exprt.domtel-sport.pl/KonkurencjeZgloszeniaCSV.php?LP=${encodeURIComponent(remoteId)}`,
    ];

    const errors: string[] = [];

    for (const url of importUrls) {
      try {
        const buffer = await this.fetchCsvBuffer(url);
        const content = this.decodeCsvContent(buffer);

        if (!this.looksLikeFederationCsv(content)) {
          if (this.looksLikeStarterRawCsv(content)) {
            const result = await this.importStarterRawCsv(
              meetingId,
              remoteId,
              content,
            );
            return { ...result, sourceUrl: url };
          }

          errors.push(`${url} -> response does not look like supported CSV`);
          continue;
        }

        const result = await this.importFederationCsv(meetingId, buffer);
        return { ...result, sourceUrl: url };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown starter import error';
        errors.push(`${url} -> ${message}`);
      }
    }

    throw new BadGatewayException(
      `Unable to import Starter meeting ${remoteId}. ${errors.join(' | ')}`,
    );
  }

  private async importStarterRawCsv(
    meetingId: string,
    remoteId: string,
    content: string,
  ): Promise<{ count: number }> {
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
    });

    const rows = parsed.data || [];
    const eventNameMap = await this.fetchStarterEventNames(remoteId);
    const syncOnlineEventNames =
      await this.shouldSyncOnlineEventNames(meetingId);
    let count = 0;

    const relayGroups = new Map<
      string,
      {
        club: string;
        eventCode: string;
        eventName: string;
        heat: number | null;
        lane: number | null;
        members: Array<{
          firstName: string;
          lastName: string;
          bib: string;
          yearOfBirth: number | null;
        }>;
      }
    >();

    const isRelay = (code: string, name: string) => {
      const combined = ((code || '') + ' ' + (name || '')).toUpperCase();
      return (
        /4\s*[xX*]\s*\d+/.test(combined) ||
        combined.includes('SZTAFETA') ||
        combined.includes('RELAY')
      );
    };

    for (const row of rows) {
      const eventCode = (row['POLE1'] || row['konk_szt'] || '').trim();
      if (!eventCode) continue;

      const eventName = (
        eventNameMap.get(eventCode) ||
        row['konk_szt'] ||
        row['POLE1'] ||
        eventCode
      ).trim();
      const club = (row['POLE7'] || '').trim();
      const athleteRaw = (row['POLE5'] || '').trim();
      if (!athleteRaw) continue; // skip synthetic/team-only rows

      const { firstName, lastName, athleteName } =
        this.parseStarterAthleteName(athleteRaw);
      const bib = (row['POLE4'] || row['Punkt'] || '').toString().trim();
      const pb = '';
      const sb = this.normalizeStarterResult(
        (row['MIEJ'] || row['SB'] || row['SB2'] || '').toString(),
      );
      const yearOfBirth = this.parseStarterYear(
        (row['POLE6'] || '').toString(),
      );
      const parsePositiveInt = (...values: Array<string | undefined>) => {
        for (const raw of values) {
          if (!raw) continue;
          const parsed = parseInt(raw.toString().trim(), 10);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return null;
      };
      // In Starter RAW CSV, RUNDA/MIEJ are often round/place, not start-list heat/lane.
      // We only trust explicit heat/lane columns when they exist.
      const heat = parsePositiveInt(
        row['Seria'],
        row['SERIA'],
        row['HEAT'],
        row['Heat'],
      );
      const lane = parsePositiveInt(
        row['Tor'],
        row['TOR'],
        row['LANE'],
        row['Lane'],
      );

      if (isRelay(eventCode, eventName)) {
        const key = `${eventCode}|${club || 'Sztafeta'}`;
        if (!relayGroups.has(key)) {
          relayGroups.set(key, {
            club: club || 'Sztafeta',
            eventCode,
            eventName,
            heat,
            lane,
            members: [],
          });
        }

        relayGroups.get(key)!.members.push({
          firstName,
          lastName,
          bib,
          yearOfBirth,
        });
        continue;
      }

      const event = await this.findOrCreateEventByCode(
        meetingId,
        eventCode,
        eventName,
        syncOnlineEventNames,
      );

      await this.entriesService.create({
        athleteName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        bib: bib || undefined,
        club,
        pb,
        sb,
        heat: heat || undefined,
        lane: lane || undefined,
        eventId: event.id,
        status: 'CONFIRMED',
        countryCode: 'POL',
        yearOfBirth: yearOfBirth || undefined,
        gender: event.gender === 'MIX' ? undefined : event.gender,
      });
      count++;
    }

    for (const group of relayGroups.values()) {
      const event = await this.findOrCreateEventByCode(
        meetingId,
        group.eventCode,
        group.eventName,
        syncOnlineEventNames,
      );
      const relaySquad = group.members.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        bib: m.bib,
        yearOfBirth: m.yearOfBirth,
      }));

      await this.entriesService.create({
        athleteName: group.club,
        club: group.club,
        heat: group.heat || undefined,
        lane: group.lane || undefined,
        eventId: event.id,
        status: 'CONFIRMED',
        countryCode: 'POL',
        gender: event.gender === 'MIX' ? undefined : event.gender,
        relaySquad: JSON.stringify(relaySquad),
      });
      count++;
    }

    return { count };
  }

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
      Nr: entry.bib || '',
      'Nazwisko i Imię': entry.athleteName,
      Klub: '',
      Seria: entry.heat || '',
      Tor: entry.lane || '',
    }));

    return Papa.unparse(data, { delimiter: ';' });
  }

  async exportFinishLynxEvt(eventId: string): Promise<string> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { entries: { where: { status: 'CONFIRMED' } } },
    });

    if (!event) throw new NotFoundException('Event not found');

    const heats = [
      ...new Set(((event as any).entries as any[]).map((e) => e.heat || 1)),
    ].sort((a, b) => a - b);
    let evtContent = '';

    for (const heat of heats) {
      const heatEntries = ((event as any).entries as any[])
        .filter((e) => (e.heat || 1) === heat)
        .sort((a, b) => (a.lane || 0) - (b.lane || 0));

      evtContent += `${event.code},1,${heat},${event.name},100\n`;

      for (const entry of heatEntries) {
        const lastName =
          entry.lastName ||
          entry.athleteName.trim().split(' ').slice(1).join(' ') ||
          entry.athleteName;
        const firstName =
          entry.firstName || entry.athleteName.trim().split(' ')[0] || '';
        evtContent += `${entry.bib || ''},${entry.lane || ''},${lastName},${firstName},\n`;
      }
      evtContent += '\n';
    }

    return evtContent;
  }

  async importFederationCsv(
    meetingId: string,
    fileBuffer: Buffer,
  ): Promise<{ count: number }> {
    const syncOnlineEventNames =
      await this.shouldSyncOnlineEventNames(meetingId);
    const content = this.decodeCsvContent(fileBuffer);
    console.log('Importing Federation CSV, length:', content.length);

    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
    });

    const entries = parsed.data as any[];
    console.log('Parsed entries count:', entries.length);

    let count = 0;

    const relayGroups = new Map<string, any[]>();

    const isRelay = (code: string, name: string) => {
      const combined = ((code || '') + ' ' + (name || '')).toUpperCase();
      // Robust check: 4x, 4 x, 4*, Sztafeta
      const isRelay =
        /4\s*[xX*]\s*\d+/.test(combined) ||
        combined.includes('SZTAFETA') ||
        combined.includes('RELAY');
      return isRelay;
    };

    // 1. First pass: Handle individuals and grouping relays
    for (const row of entries) {
      // Support various formats
      let athleteName =
        row['Imię i Nazwisko'] || row['Zawodnik'] || row['Athlete'];

      // Support separate columns (e.g. Domtel/PZLA format)
      if (!athleteName && row['Imię'] && row['Nazwisko']) {
        athleteName = `${row['Imię']} ${row['Nazwisko']}`;
      }

      // Event mapping — use 'Sztafeta' column to detect relay code in PZLA format
      const rawEventCode =
        row['NazwaPZLA'] ||
        row['Konkurencja'] ||
        row['KonkurencjaKod'] ||
        row['Event'];
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
      const rowIsRelay =
        isRelay(eventCode, eventName) ||
        (sztafetaCol.length > 0 && isRelay(sztafetaCol, ''));

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
            yearOfBirth,
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
      const event = await this.findOrCreateEventByCode(
        meetingId,
        eventCode,
        eventName,
        syncOnlineEventNames,
      );

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
      const memberWithRow = members.find((m) => m.rawRow) || members[0];
      const row = memberWithRow.rawRow || {};

      // Use the relay event code from the key (first part before |)
      const relayEventCode = key.split('|')[0].trim();
      const eventName = (row['Pełna nazwa'] || relayEventCode || '').trim();
      const club = (row['Klub_nazwa'] || row['Klub'] || 'Sztafeta').trim();
      const heat = row['Seria'] ? parseInt(row['Seria'], 10) : null;
      const lane = row['Tor'] ? parseInt(row['Tor'], 10) : null;

      // Find or create event using normalized code
      const event = await this.findOrCreateEventByCode(
        meetingId,
        relayEventCode,
        eventName,
        syncOnlineEventNames,
      );

      // Build squad JSON — only members with actual names
      const relaySquad = members
        .filter((m) => m.firstName || m.lastName)
        .map((m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          bib: m.bib,
          yearOfBirth: m.yearOfBirth,
        }));

      console.log(
        `Creating relay entry: club=${club}, event=${event.name} (${event.code}), members=${relaySquad.length}`,
      );
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
        relaySquad: JSON.stringify(relaySquad),
      });
      count++;
    }

    return { count };
  }

  private decodeCsvContent(buffer: Buffer): string {
    return decodeTextBuffer(buffer);
  }

  private looksLikeFederationCsv(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }

    const upper = trimmed.toUpperCase();
    if (upper.includes('<HTML') && !upper.includes('NAZWAPZLA')) {
      return false;
    }

    return (
      upper.includes('NAZWAPZLA') ||
      upper.includes('PELNA NAZWA') ||
      upper.includes('IMIE') ||
      upper.includes('NAZWISKO') ||
      upper.includes(';')
    );
  }

  private looksLikeStarterRawCsv(content: string): boolean {
    const upper = content.toUpperCase();
    return (
      upper.includes('ID_LOKAL,ID,IDBAZA') &&
      upper.includes('POLE1') &&
      upper.includes('POLE4')
    );
  }

  private async fetchCsvBuffer(url: string): Promise<Buffer> {
    const httpsAgent = new HttpsAgent({ rejectUnauthorized: false });
    const response = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        httpsAgent,
      }),
    );
    return Buffer.from(response.data);
  }

  private parseStarterMeetingList(content: string): StarterMeeting[] {
    const text = content.replace(/^\uFEFF/, '').trim();
    if (!text) {
      return [];
    }

    const meetings: StarterMeeting[] = [];
    const byId = new Map<string, StarterMeeting>();
    const delimiters = [',', ';', '\t', '|'];

    for (const delimiter of delimiters) {
      const headerParsed = Papa.parse<Record<string, string>>(text, {
        delimiter,
        header: true,
        skipEmptyLines: true,
      });

      if (headerParsed.meta.fields && headerParsed.meta.fields.length > 1) {
        for (const row of headerParsed.data) {
          const meeting = this.extractMeetingFromHeaderRow(row);
          if (!meeting) continue;
          byId.set(meeting.id, meeting);
        }
      }

      if (byId.size > 0) {
        break;
      }
    }

    if (byId.size === 0) {
      for (const delimiter of delimiters) {
        const rowsParsed = Papa.parse<string[]>(text, {
          delimiter,
          header: false,
          skipEmptyLines: true,
        });

        for (const row of rowsParsed.data) {
          const meeting = this.extractMeetingFromArrayRow(row);
          if (!meeting) continue;
          byId.set(meeting.id, meeting);
        }

        if (byId.size > 0) {
          break;
        }
      }
    }

    byId.forEach((meeting) => meetings.push(meeting));
    return meetings;
  }

  private async fetchStarterEventNames(
    remoteId: string,
  ): Promise<Map<string, string>> {
    const urls = [
      `http://exprt.domtel-sport.pl/KonkurencjeZgloszeniaCSV.php?LP=${encodeURIComponent(remoteId)}&wersja=5`,
      `http://exprt.domtel-sport.pl/KonkurencjeZgloszeniaCSV.php?LP=${encodeURIComponent(remoteId)}`,
    ];

    for (const url of urls) {
      try {
        const buffer = await this.fetchCsvBuffer(url);
        const content = this.decodeCsvContent(buffer);
        const parsed = Papa.parse<Record<string, string>>(content, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
        });

        const map = new Map<string, string>();
        for (const row of parsed.data || []) {
          const code = (
            row['konkrencja'] ||
            row['Konkurencja'] ||
            row['Nazwa_skrot'] ||
            ''
          ).trim();
          if (!code) continue;
          const full = (
            row['Pelna_nazwa'] ||
            row['Konkurencja'] ||
            row['konkrencja'] ||
            code
          ).trim();
          map.set(code, full);
        }

        if (map.size > 0) {
          return map;
        }
      } catch {
        // Ignore and fallback to next URL.
      }
    }

    return new Map<string, string>();
  }

  private parseStarterAthleteName(athleteRaw: string): {
    firstName: string;
    lastName: string;
    athleteName: string;
  } {
    const parts = athleteRaw.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return {
        firstName: athleteRaw.trim(),
        lastName: '',
        athleteName: athleteRaw.trim(),
      };
    }

    const lastName = parts[0];
    const firstName = parts.slice(1).join(' ');
    return {
      firstName,
      lastName,
      athleteName: `${firstName} ${lastName}`.trim(),
    };
  }

  private parseStarterYear(raw: string): number | null {
    const year = parseInt(raw, 10);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      return null;
    }
    return year;
  }

  private normalizeStarterResult(value: string): string {
    let normalized = (value || '').trim();
    if (!normalized || normalized === '99:99.99') {
      return '';
    }

    normalized = normalized.replace(/^['"]+|['"]+$/g, '').trim();

    const slashIndex = normalized.indexOf('/');
    if (slashIndex > 0) {
      normalized = normalized.slice(0, slashIndex).trim();
    }

    return normalized;
  }
  private extractMeetingFromHeaderRow(
    row: Record<string, string>,
  ): StarterMeeting | null {
    const normalized = new Map<string, string>();
    Object.entries(row).forEach(([key, value]) => {
      normalized.set(this.normalizeHeader(key), (value || '').trim());
    });

    const id =
      this.getFirstValue(normalized, [
        'lp',
        'id',
        'numerimprezy',
        'nrimprezy',
        'idimprezy',
      ]) || '';
    if (!id) {
      return null;
    }

    const name =
      this.getFirstValue(normalized, [
        'impreza',
        'nazwa',
        'nazwazawodow',
        'nazwaimprezy',
      ]) || `Impreza ${id}`;

    const location =
      this.getFirstValue(normalized, ['miejsce', 'miasto', 'lokalizacja']) ||
      '';
    const dateLabel =
      this.getFirstValue(normalized, [
        'data',
        'dataimprezy',
        'termin',
        'daty',
        'dataod',
        'datarozpoczecia',
      ]) || '';

    return this.buildStarterMeeting(id, name, location, dateLabel);
  }

  private extractMeetingFromArrayRow(values: string[]): StarterMeeting | null {
    const cells = values
      .map((value) => `${value || ''}`.trim())
      .filter(Boolean);
    if (cells.length < 2) {
      return null;
    }

    const idIndex = cells.findIndex((cell) => /^\d+$/.test(cell));
    if (idIndex < 0) {
      return null;
    }

    const id = cells[idIndex];
    const rest = cells.filter((_, index) => index !== idIndex);
    const name = rest[0] || `Impreza ${id}`;
    const location = rest[1] || '';
    const dateLabel = rest[2] || '';

    return this.buildStarterMeeting(id, name, location, dateLabel);
  }

  private buildStarterMeeting(
    id: string,
    name: string,
    location: string,
    dateLabel: string,
  ): StarterMeeting {
    const labelParts = [name.trim()];
    const suffix = [location.trim(), dateLabel.trim()]
      .filter(Boolean)
      .join(', ');
    if (suffix) {
      labelParts.push(suffix);
    }

    return {
      id: id.trim(),
      name: name.trim(),
      location: location.trim(),
      dateLabel: dateLabel.trim(),
      label: labelParts.join(' - '),
    };
  }

  private normalizeHeader(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private getFirstValue(
    map: Map<string, string>,
    candidateKeys: string[],
  ): string | null {
    for (const key of candidateKeys) {
      const value = map.get(this.normalizeHeader(key));
      if (value) {
        return value;
      }
    }
    return null;
  }

  private async shouldSyncOnlineEventNames(
    meetingId: string,
  ): Promise<boolean> {
    const meeting = await (this.prisma as any).meeting.findUnique({
      where: { id: meetingId },
      select: { syncOnlineEventNames: true },
    });
    return !!meeting?.syncOnlineEventNames;
  }

  private async findOrCreateEventByCode(
    meetingId: string,
    eventCode: string,
    eventName: string,
    syncOnlineEventNames = false,
  ) {
    const code = eventCode.trim();
    const onlineEventName = (eventName || '').trim();

    let event = await this.prisma.event.findFirst({
      where: { meetingId, code },
    });

    if (!event) {
      const gender = this.guessGender(code, eventName);
      const enhancedName = this.enhanceEventNameWithHurdles(
        onlineEventName || code,
        code,
        gender,
      );

      event = await this.prisma.event.create({
        data: {
          name: enhancedName,
          code,
          gender,
          meetingId,
        },
      });
    }

    if (event && syncOnlineEventNames && onlineEventName) {
      const enhancedOnlineName = this.enhanceEventNameWithHurdles(
        onlineEventName,
        code,
        event.gender,
      );

      if (enhancedOnlineName && enhancedOnlineName !== event.name) {
        event = await this.prisma.event.update({
          where: { id: event.id },
          data: { name: enhancedOnlineName },
        });
      }
    }

    return event;
  }

  private guessGender(code: string, name: string): 'M' | 'F' | 'MIX' {
    const text = (code + ' ' + name).toUpperCase();
    if (
      text.includes('KOBIET') ||
      text.startsWith('K') ||
      text.includes('WOMEN') ||
      text.includes('DZIEWCZ')
    )
      return 'F';
    if (
      text.includes('MĘŻCZYZN') ||
      text.startsWith('M') ||
      text.includes('MEN') ||
      text.includes('CHŁOP')
    )
      return 'M';
    return 'MIX';
  }

  private enhanceEventNameWithHurdles(
    name: string,
    code: string,
    gender: string,
  ): string {
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
