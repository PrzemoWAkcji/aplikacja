import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { EntryStatus } from '@prisma/client';

type FinishLynxEntry = {
  athleteName: string;
  firstName: string | null;
  lastName: string | null;
  bib: string | null;
  club: string | null;
  lane: number | null;
  heat: number | null;
  startListId: string | null;
  entryId: string | null;
  relaySquad: string | null;
};

type FinishLynxEvent = {
  id: string;
  name: string;
  code: string | null;
  eventCode: string | null;
  model: string | null;
  stage: string;
  startTime: Date | null;
  createdAt: Date;
  entries: FinishLynxEntry[];
};

type FinishLynxMapEntry = {
  eventNumber: number;
  roundType: number;
  heatNo: number;
  eventId: string;
  eventName: string;
};

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  private normalizeParticipantText(value?: string | null) {
    return (value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private buildParticipantKey(entry: {
    athleteId?: string | null;
    athleteName?: string | null;
    yearOfBirth?: number | null;
    dateOfBirth?: Date | null;
    bib?: string | null;
  }) {
    if (entry.athleteId) return `id:${entry.athleteId}`;

    const name = this.normalizeParticipantText(entry.athleteName);
    const year =
      entry.yearOfBirth ??
      (entry.dateOfBirth ? entry.dateOfBirth.getFullYear() : null);
    const bib = this.normalizeParticipantText(entry.bib);

    return `name:${name}|year:${year ?? ''}|bib:${bib}`;
  }

  private normalizeDomtelMeetingCode(value?: string | null): string | null {
    const raw = (value || '').trim();
    if (!raw) return null;

    try {
      const parsed = new URL(raw);
      const fromQuery = (parsed.searchParams.get('impreza') || '').trim();
      if (fromQuery) return fromQuery;
    } catch {
      // Input is not a full URL; continue with manual parsing.
    }

    const match = raw.match(/[?&]impreza=([a-z0-9_-]+)/i);
    if (match?.[1]) return match[1];

    const normalized = raw.replace(/^impreza=/i, '').trim();
    if (/^[a-z0-9_-]+$/i.test(normalized)) {
      return normalized;
    }

    return null;
  }

  private buildDomtelOnlineUrl(code?: string | null): string | null {
    const normalized = this.normalizeDomtelMeetingCode(code);
    if (!normalized) return null;
    return `https://online.domtel-sport.pl/index2.php?impreza=${encodeURIComponent(
      normalized,
    )}`;
  }

  create(createMeetingDto: CreateMeetingDto, organizerId: string) {
    const { date, endDate, domtelMeetingCode, ...rest } = createMeetingDto;
    return this.prisma.meeting.create({
      data: {
        ...rest,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        domtelMeetingCode: this.normalizeDomtelMeetingCode(domtelMeetingCode),
        organizerId,
      } as any,
    });
  }

  async findAll() {
    const meetings = await this.prisma.meeting.findMany({
      include: {
        events: true,
      },
    });

    return meetings.map((meeting) => ({
      ...meeting,
      domtelOnlineUrl: this.buildDomtelOnlineUrl(meeting.domtelMeetingCode),
    }));
  }

  async findOne(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        events: {
          include: {
            entries: {
              select: {
                heat: true,
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
    });

    if (!meeting) return null;
    const sortedEvents = this.sortEventsBySchedule(meeting.events as any[]);

    const entries = await this.prisma.entry.findMany({
      where: {
        event: { meetingId: id },
      },
      select: {
        athleteId: true,
        athleteName: true,
        yearOfBirth: true,
        dateOfBirth: true,
        bib: true,
        status: true,
      },
    });

    const activeEntries = entries.filter((entry) => entry.status !== 'SCRATCHED');
    const participants = new Set<string>();
    activeEntries.forEach((entry) => {
      participants.add(this.buildParticipantKey(entry));
    });

    return {
      ...meeting,
      events: sortedEvents,
      domtelOnlineUrl: this.buildDomtelOnlineUrl(meeting.domtelMeetingCode),
      stats: {
        persons: participants.size,
        personStarts: activeEntries.length,
      },
    };
  }

  async update(id: string, updateMeetingDto: UpdateMeetingDto, requestingUserId: string, requestingUserRole: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (requestingUserRole !== 'ADMIN' && meeting.organizerId !== requestingUserId) {
      throw new ForbiddenException('Brak dostępu do tego meetingu');
    }

    const { date, endDate, domtelMeetingCode, ...rest } = updateMeetingDto;
    const data: any = { ...rest };
    if (date) {
      data.date = new Date(date);
    }
    if (endDate) {
      data.endDate = new Date(endDate);
    }
    if (domtelMeetingCode !== undefined) {
      data.domtelMeetingCode =
        this.normalizeDomtelMeetingCode(domtelMeetingCode);
    }
    return this.prisma.meeting.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, requestingUserId: string, requestingUserRole: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (requestingUserRole !== 'ADMIN' && meeting.organizerId !== requestingUserId) {
      throw new ForbiddenException('Brak dostępu do tego meetingu');
    }
    // Cascade delete children manually since schema lacks onDelete: Cascade
    await this.deleteAllEvents(id);

    return this.prisma.meeting.delete({
      where: { id },
    });
  }

  async deleteAllEvents(meetingId: string) {
    const events = await this.prisma.event.findMany({
      where: { meetingId },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);

    if (eventIds.length > 0) {
      // Find entries associated with these events to clean up results
      const entries = await this.prisma.entry.findMany({
        where: { eventId: { in: eventIds } },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);

      if (entryIds.length > 0) {
        // Delete results associated with entries first
        await this.prisma.result.deleteMany({
          where: { entryId: { in: entryIds } },
        });

        // Then delete entries
        await this.prisma.entry.deleteMany({
          where: { id: { in: entryIds } },
        });
      }

      // Finally delete events
      await this.prisma.event.deleteMany({
        where: { meetingId },
      });
    }
    return { count: eventIds.length };
  }

  async getPrintData(id: string) {
    return this.prisma.meeting.findUnique({
      where: { id },
      include: {
        events: {
          include: {
            entries: {
              where: { status: 'CONFIRMED' },
              orderBy: [{ heat: 'asc' }, { lane: 'asc' }],
            },
          },
          orderBy: {
            // Assuming we want some logical order, e.g., by name or creation?
            // Schema doesn't have 'order' field yet, utilizing code or name.
            code: 'asc',
          },
        },
      },
    });
  }

  async generateFinishLynxFiles(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      select: {
        name: true,
        events: {
          orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            code: true,
            eventCode: true,
            model: true,
            stage: true,
            startTime: true,
            createdAt: true,
            entries: {
              where: {
                status: { not: EntryStatus.SCRATCHED },
              },
              orderBy: [{ heat: 'asc' }, { lane: 'asc' }, { athleteName: 'asc' }],
              select: {
                athleteName: true,
                firstName: true,
                lastName: true,
                bib: true,
                club: true,
                lane: true,
                heat: true,
                startListId: true,
                entryId: true,
                relaySquad: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const evtLines: string[] = [
      "; Plik, 'lynx.evt': exportowano z programu Zawody LA PRO",
    ];
    const schLines: string[] = [
      "; Plik, 'lynx.sch': exportowano z programu Zawody LA",
    ];
    const lynxMapEntries: FinishLynxMapEntry[] = [];

    let eventNumber = 1;
    const finishLynxEvents = this.sortEventsBySchedule(
      (meeting.events as FinishLynxEvent[]).filter((event) =>
        this.shouldIncludeEventInFinishLynx(event) &&
        this.hasSeededFinishLynxEntries(event),
      ),
    );

    for (const event of finishLynxEvents) {
      const seededEntries = (event.entries || []).filter((entry) =>
        this.isSeededFinishLynxEntry(entry),
      );
      const heatGroups = this.groupFinishLynxEntries(seededEntries);
      if (heatGroups.length === 0) {
        continue;
      }
      const roundType = this.resolveFinishLynxRoundType(
        event.stage,
        event.name,
        heatGroups.length,
      );

      for (let index = 0; index < heatGroups.length; index++) {
        const group = heatGroups[index];
        const heatNo = this.resolveFinishLynxHeatNumber({
          roundType,
          explicitHeat: group.heat,
          groupIndex: index,
          groupCount: heatGroups.length,
          stage: event.stage,
          eventName: event.name,
        });
        const displayEventName = this.buildFinishLynxEventName(
          event.name,
          roundType,
          heatNo,
        );

        schLines.push(this.finishLynxCsvRow([eventNumber, roundType, heatNo]));
        evtLines.push(
          this.finishLynxCsvRow([
            eventNumber,
            roundType,
            heatNo,
            displayEventName,
            '',
            '',
            '',
            '',
            '',
            '',
          ]),
        );
        lynxMapEntries.push({
          eventNumber,
          roundType,
          heatNo,
          eventId: event.id,
          eventName: event.name,
        });

        const sortedEntries = this.sortFinishLynxEntries(group.entries);
        for (let i = 0; i < sortedEntries.length; i++) {
          const entry = sortedEntries[i];
          const lane = entry.lane && entry.lane > 0 ? entry.lane : i + 1;
          const reference = (entry.startListId || entry.entryId || '').trim();

          if (this.isRelayEntryForFinishLynx(entry)) {
            const teamName = (entry.athleteName || entry.club || '').trim();
            const club = (entry.club || teamName).trim();
            evtLines.push(
              this.finishLynxCsvRow([
                '',
                '',
                lane,
                teamName,
                '',
                club,
                '',
                reference,
              ]),
            );
            continue;
          }

          const { firstName, lastName } = this.splitFinishLynxName(entry);
          evtLines.push(
            this.finishLynxCsvRow([
              '',
              (entry.bib || '').trim(),
              lane,
              lastName,
              firstName,
              (entry.club || '').trim(),
              '',
              reference,
            ]),
          );
        }

        eventNumber++;
      }
    }

    return {
      meetingName: meeting.name,
      evt: `${evtLines.join('\r\n')}\r\n`,
      sch: `${schLines.join('\r\n')}\r\n`,
      mapEntries: lynxMapEntries,
    };
  }

  async writeFinishLynxFilesToDisk(id: string) {
    const exportData = await this.generateFinishLynxFiles(id);
    // Ścieżka eksportu pochodzi wyłącznie ze zmiennej środowiskowej
    const exportDir = this.resolveFinishLynxExportDir(process.env.FINISHLYNX_EXPORT_DIR);
    const evtPath = path.join(exportDir, 'Lynx.evt');
    const schPath = path.join(exportDir, 'Lynx.sch');
    const mapPath = path.join(exportDir, 'Lynx.map.json');

    try {
      fs.mkdirSync(exportDir, { recursive: true });
      this.writeFinishLynxFileAtomically(evtPath, exportData.evt);
      this.writeFinishLynxFileAtomically(schPath, exportData.sch);
      fs.writeFileSync(
        mapPath,
        JSON.stringify(
          {
            meetingName: exportData.meetingName,
            generatedAt: new Date().toISOString(),
            entries: exportData.mapEntries,
          },
          null,
          2,
        ),
        { encoding: 'utf8', flag: 'w' },
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Nie udało się zapisać plików FinishLynx do katalogu ${exportDir}.`,
      );
    }

    return {
      meetingName: exportData.meetingName,
      exportDir,
      evtPath,
      schPath,
      mapPath,
      savedAt: new Date().toISOString(),
    };
  }

  private writeFinishLynxFileAtomically(filePath: string, content: string) {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(
      dir,
      `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
    );

    fs.writeFileSync(tmpPath, content, { encoding: 'latin1', flag: 'w' });
    try {
      fs.renameSync(tmpPath, filePath);
    } catch {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      fs.renameSync(tmpPath, filePath);
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }

  private resolveFinishLynxExportDir(rawPath?: string) {
    const raw = (rawPath || '').trim();
    if (!raw) {
      if (process.platform === 'win32') return 'C:\\Zawody';
      if (fs.existsSync('/app/lynx_data')) return '/app/lynx_data';
      return '/tmp/zawody';
    }

    if (process.platform !== 'win32') {
      const asSlashes = raw.replace(/\\/g, '/');
      const hasDockerLynxMount = fs.existsSync('/app/lynx_data');
      const looksLikeWindowsPath =
        /^[A-Za-z]:\//.test(asSlashes) ||
        /^\/\/[^/]+\/[^/]+/.test(asSlashes) ||
        /^[^/:]+\/[^/]+/.test(asSlashes);

      if (hasDockerLynxMount && looksLikeWindowsPath) {
        return '/app/lynx_data';
      }

      if (/^\/\/[^/]+\/[^/]+/.test(asSlashes)) return asSlashes;
      if (/^[^/:]+\/[^/]+/.test(asSlashes)) return `//${asSlashes}`;
      return asSlashes;
    }

    const asBackslashes = raw.replace(/\//g, '\\');

    if (/^[A-Za-z]:\\/.test(asBackslashes)) {
      return asBackslashes;
    }

    if (asBackslashes.startsWith('\\\\')) {
      return asBackslashes;
    }

    if (/^[^\\:]+\\[^\\]+/.test(asBackslashes)) {
      return `\\\\${asBackslashes.replace(/^\\+/, '')}`;
    }

    return asBackslashes;
  }

  private groupFinishLynxEntries(entries: FinishLynxEntry[]) {
    if (!entries || entries.length === 0) {
      return [] as { heat: number; entries: FinishLynxEntry[] }[];
    }

    const groups = new Map<number, FinishLynxEntry[]>();

    for (const entry of entries) {
      if (!this.isSeededFinishLynxEntry(entry)) {
        continue;
      }
      const heat = entry.heat as number;
      if (!groups.has(heat)) {
        groups.set(heat, []);
      }
      groups.get(heat)?.push(entry);
    }

    const orderedHeats = [...groups.keys()].sort((a, b) => a - b);

    return orderedHeats.map((heat) => ({
      heat,
      entries: groups.get(heat) || [],
    }));
  }

  private isSeededFinishLynxEntry(entry: FinishLynxEntry) {
    return (entry.heat || 0) > 0;
  }

  private hasSeededFinishLynxEntries(event: FinishLynxEvent) {
    return (event.entries || []).some((entry) =>
      this.isSeededFinishLynxEntry(entry),
    );
  }

  private sortEventsBySchedule<
    T extends {
      startTime?: Date | string | null;
      createdAt?: Date | string | null;
      code?: string | null;
      eventCode?: string | null;
      name?: string | null;
    },
  >(events: T[]) {
    return [...events].sort((a, b) => {
      const aStart = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;

      const aKey = (a.name || a.code || a.eventCode || '').trim();
      const bKey = (b.name || b.code || b.eventCode || '').trim();
      return aKey.localeCompare(bKey, 'pl', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  private sortFinishLynxEntries(entries: FinishLynxEntry[]) {
    return [...entries].sort((a, b) => {
      const laneA = a.lane ?? Number.MAX_SAFE_INTEGER;
      const laneB = b.lane ?? Number.MAX_SAFE_INTEGER;
      if (laneA !== laneB) return laneA - laneB;

      const bibA = this.parseNumericBib(a.bib);
      const bibB = this.parseNumericBib(b.bib);
      if (bibA !== bibB) return bibA - bibB;

      return (a.athleteName || '').localeCompare(b.athleteName || '', 'pl');
    });
  }

  private parseNumericBib(bib?: string | null) {
    if (!bib) return Number.MAX_SAFE_INTEGER;
    const parsed = parseInt(bib, 10);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  }

  private resolveFinishLynxRoundType(
    stage?: string | null,
    eventName?: string,
    groupCount = 1,
  ) {
    if (groupCount > 1) {
      return 1;
    }

    const normalizedStage = this.normalizeFinishLynxText(stage || '');
    const normalizedEventName = this.normalizeFinishLynxText(eventName || '');

    if (
      normalizedEventName.includes('semi') ||
      normalizedStage.includes('semi') ||
      normalizedStage.includes('polfinal') ||
      normalizedEventName.includes('polfinal')
    ) {
      return 2;
    }

    const finalIndexFromEventName = this.extractFinishLynxFinalLabelIndex(
      normalizedEventName,
    );
    if (finalIndexFromEventName !== null) {
      return 3;
    }

    if (
      /\b(final|fina)\b/i.test(normalizedEventName) &&
      !/\b(bieg|seria|heat)\b/i.test(normalizedEventName)
    ) {
      return 3;
    }

    return 1;
  }

  private resolveFinishLynxHeatNumber(params: {
    roundType: number;
    explicitHeat: number;
    groupIndex: number;
    groupCount: number;
    stage?: string | null;
    eventName?: string;
  }) {
    const {
      roundType,
      explicitHeat,
      groupIndex,
      groupCount,
      stage,
      eventName,
    } = params;

    if (roundType === 3) {
      if (explicitHeat > 0) return explicitHeat;
      const finalLabelIndexFromEventName =
        this.extractFinishLynxFinalLabelIndex(eventName || '');
      return finalLabelIndexFromEventName ?? 0;
    }

    if (explicitHeat > 0) return explicitHeat;
    if (groupCount <= 1) return 1;
    return groupIndex + 1;
  }

  private extractFinishLynxFinalLabelIndex(value: string): number | null {
    const normalized = this.normalizeFinishLynxText(value);
    const letterMatch = normalized.match(
      /(?:^|\s)(?:final|fina)[\s-]*([a-f])(?:\b|$)/i,
    );
    if (letterMatch?.[1]) {
      const letter = letterMatch[1].toUpperCase();
      return letter.charCodeAt(0) - 64;
    }

    const numberMatch = normalized.match(
      /(?:^|\s)(?:final|fina)[\s-]*(\d{1,2})(?:\b|$)/i,
    );
    if (numberMatch?.[1]) {
      const parsed = parseInt(numberMatch[1], 10);
      if (parsed >= 1 && parsed <= 26) {
        return parsed;
      }
    }

    return null;
  }

  private buildFinishLynxEventName(
    baseEventName: string,
    roundType: number,
    heatNo: number,
  ) {
    const base = (baseEventName || 'Konkurencja').trim();
    const normalized = this.normalizeFinishLynxText(base);

    if (
      roundType === 1 &&
      heatNo > 0 &&
      !/\b(bieg|seria|heat)\b/i.test(normalized)
    ) {
      return `${base}-Bieg ${heatNo}`;
    }

    if (
      roundType === 2 &&
      heatNo > 0 &&
      !/\b(semi|polfinal)\b/i.test(normalized)
    ) {
      return `${base}-SEMIFINAL ${heatNo}`;
    }

    if (roundType === 3 && !/\b(final|fina)\b/i.test(normalized)) {
      if (heatNo > 0) {
        return `${base}-FINAL ${this.toFinalHeatLabel(heatNo)}`;
      }
      return `${base}-FINAL`;
    }

    return base;
  }

  private toFinalHeatLabel(heatNo: number) {
    if (heatNo >= 1 && heatNo <= 26) {
      return String.fromCharCode(64 + heatNo);
    }
    return String(heatNo);
  }

  private splitFinishLynxName(entry: FinishLynxEntry) {
    const lastName = (entry.lastName || '').trim();
    const firstName = (entry.firstName || '').trim();

    if (lastName || firstName) {
      return { firstName, lastName };
    }

    const fullName = (entry.athleteName || '').trim();
    if (!fullName) {
      return { firstName: '', lastName: '' };
    }

    if (fullName.includes(',')) {
      const [last, ...first] = fullName.split(',');
      return {
        lastName: last.trim(),
        firstName: first.join(' ').trim(),
      };
    }

    const parts = fullName.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: '', lastName: parts[0] };
    }

    return {
      lastName: parts[parts.length - 1],
      firstName: parts.slice(0, -1).join(' '),
    };
  }

  private isRelayEntryForFinishLynx(entry: FinishLynxEntry) {
    const relaySquadRaw = (entry.relaySquad || '').trim();
    if (relaySquadRaw) {
      try {
        const parsed = JSON.parse(relaySquadRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return true;
        }
      } catch {
        // Ignore malformed relay squad and fall back to event-name heuristics.
      }
    }

    const normalized = this.normalizeFinishLynxText(entry.athleteName || '');
    return (
      normalized.includes('sztafet') ||
      normalized.includes('relay') ||
      normalized.includes('4x')
    );
  }

  private finishLynxCsvRow(values: Array<string | number | null | undefined>) {
    return values.map((value) => this.escapeFinishLynxCsvValue(value)).join(',');
  }

  private escapeFinishLynxCsvValue(value: string | number | null | undefined) {
    const rawText = value === null || value === undefined ? '' : String(value);
    const text = this.toFinishLynxSingleByteText(rawText);
    if (!/[",\r\n]/.test(text)) {
      return text;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }

  private toFinishLynxSingleByteText(value: string) {
    const polishMap: Record<string, string> = {
      Ą: 'A',
      ą: 'a',
      Ć: 'C',
      ć: 'c',
      Ę: 'E',
      ę: 'e',
      Ł: 'L',
      ł: 'l',
      Ń: 'N',
      ń: 'n',
      Ó: 'O',
      ó: 'o',
      Ś: 'S',
      ś: 's',
      Ź: 'Z',
      ź: 'z',
      Ż: 'Z',
      ż: 'z',
    };

    return value
      .replace(/[ĄąĆćĘęŁłŃńÓóŚśŹźŻż]/g, (char) => polishMap[char] || char)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/[\u201C\u201D\u2033]/g, '"')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  private shouldIncludeEventInFinishLynx(event: FinishLynxEvent) {
    const model = this.normalizeFinishLynxText(event.model || '');
    if (
      model.includes('field') ||
      model.includes('tech') ||
      model.includes('jump') ||
      model.includes('throw')
    ) {
      return false;
    }

    const combined = this.normalizeFinishLynxText(
      `${event.name || ''} ${event.code || ''} ${event.eventCode || ''}`,
    );

    const fieldKeywords = [
      'kula',
      'dysk',
      'mlot',
      'oszczep',
      'wzwyz',
      'tycz',
      'dal',
      'trojskok',
      'wieloskok',
      'shot',
      'discus',
      'hammer',
      'javelin',
      'high jump',
      'pole vault',
      'long jump',
      'triple jump',
      'skok',
      'rzut',
      'pch',
      'hj',
      'pv',
      'lj',
      'tj',
      'sp',
      'dt',
      'jt',
      'ht',
    ];

    if (fieldKeywords.some((keyword) => combined.includes(keyword))) {
      return false;
    }

    const multiEventKeywords = [
      'piecioboj',
      'siedmioboj',
      'dziesiecioboj',
      'pentathlon',
      'heptathlon',
      'decathlon',
    ];

    if (multiEventKeywords.some((keyword) => combined.includes(keyword))) {
      return false;
    }

    return true;
  }

  private normalizeFinishLynxText(value: string) {
    return value
      .toLowerCase()
      .replace(/\u0142/g, 'l')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- BRANDING ---

  private getUploadsPath() {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    const ext = path.extname(file.originalname);
    const filename = `logo-${id}-${Date.now()}${ext}`;
    const uploadDir = this.getUploadsPath();
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    // Update DB
    return this.prisma.meeting.update({
      where: { id },
      data: { organizerLogo: filename },
    });
  }

  async uploadSponsor(id: string, file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    const ext = path.extname(file.originalname);
    const filename = `sponsor-${id}-${Date.now()}-${Math.round(Math.random() * 1000)}${ext}`;
    const uploadDir = this.getUploadsPath();
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    // Update DB - Append to array
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      select: { sponsorLogos: true },
    });
    const currentLogos = meeting?.sponsorLogos || [];

    return this.prisma.meeting.update({
      where: { id },
      data: { sponsorLogos: [...currentLogos, filename] },
    });
  }

  async removeLogo(id: string) {
    return this.prisma.meeting.update({
      where: { id },
      data: { organizerLogo: null },
    });
    // Optionally delete file from disk, but skipping for simplicity
  }

  async clearSponsors(id: string) {
    return this.prisma.meeting.update({
      where: { id },
      data: { sponsorLogos: [] },
    });
  }

  getUploadedFile(filename: string, res: Response) {
    // Sanityzacja: odrzuć separatory ścieżki i sekwencje traversal
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename || /[/\\]/.test(filename)) {
      (res as any).status(400).send('Invalid filename');
      return;
    }
    const uploadsDir = this.getUploadsPath();
    const filepath = path.join(uploadsDir, safeName);
    // Weryfikacja że plik leży w dozwolonym katalogu (ochrona przed edge-case)
    if (!filepath.startsWith(uploadsDir + path.sep) && filepath !== uploadsDir) {
      (res as any).status(403).send('Forbidden');
      return;
    }
    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      (res as any).status(404).send('File not found');
    }
  }

  // Default scoring table from PZLA/MDB: place 1..16 → points
  private readonly DEFAULT_SCORING_TABLE = [
    15, 12, 10, 9, 8, 8, 7, 7, 6, 5, 4, 3, 2, 2, 2, 2,
  ];

  async getTeamStandings(meetingId: string) {
    const meeting = await (this.prisma as any).meeting.findUnique({
      where: { id: meetingId },
      select: { teamScoringEnabled: true, teamScoringTable: true },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    const scoringTable: number[] = meeting.teamScoringTable
      ? JSON.parse(meeting.teamScoringTable)
      : this.DEFAULT_SCORING_TABLE;

    // Fetch all entries with results for this meeting (via events)
    const entries = await (this.prisma as any).entry.findMany({
      where: {
        event: { meetingId },
        status: { not: 'SCRATCHED' },
      },
      select: {
        club: true,
        athleteName: true,
        gender: true,
        event: { select: { name: true, code: true, gender: true } },
        result: { select: { place: true, placeGender: true, status: true } },
      },
    });

    // Map: club → { totalPoints, athletes: [...] }
    const clubMap = new Map<
      string,
      { totalPoints: number; details: { eventName: string; athleteName: string; place: number; points: number }[] }
    >();

    for (const entry of entries) {
      const result = entry.result;
      if (!result || !result.place || result.status === 'DNS' || result.status === 'DQ' || result.status === 'NM') {
        continue;
      }

      const place = result.place;
      const points = place >= 1 && place <= scoringTable.length
        ? scoringTable[place - 1]
        : 0;

      if (points === 0) continue;

      const club = (entry.club || 'Brak klubu').trim();
      if (!clubMap.has(club)) {
        clubMap.set(club, { totalPoints: 0, details: [] });
      }

      const clubData = clubMap.get(club)!;
      clubData.totalPoints += points;
      clubData.details.push({
        eventName: entry.event.name,
        athleteName: entry.athleteName,
        place,
        points,
      });
    }

    const standings = Array.from(clubMap.entries())
      .map(([club, data]) => ({ club, ...data }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((row, idx) => ({ rank: idx + 1, ...row }));

    return {
      enabled: meeting.teamScoringEnabled,
      scoringTable,
      standings,
    };
  }
}
