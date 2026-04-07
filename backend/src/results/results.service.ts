import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import * as iconv from 'iconv-lite';
import { PointsService } from './points.service';

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async importLif(eventId: string, fileBuffer: Buffer) {
    const content = iconv.decode(fileBuffer, 'windows-1250');
    const parsed = Papa.parse(content, { header: false, skipEmptyLines: true });

    const rows = parsed.data as string[][];
    if (rows.length === 0) return { imported: 0 };

    let startIdx = 0;
    let heatFilter: number | null = null;
    let globalWind: number | null = null;
    let lifCompletedClock: string | null = null;
    const prisma = this.prisma as any;
    const eventMeta = await prisma.event.findUnique({
      where: { id: eventId },
      select: { completedTime: true },
    });

    if (rows[0]) {
      const r0 = rows[0];
      const isStrictInt = (value?: string | null) =>
        /^\d+$/.test((value ?? '').trim());
      // Check for Header Format
      // 32,3,0,100m K-FINAA,+1.3,M/S,,,,,18:26:24.8402
      // Col 0,1,2 integers. Col 3 text. Col 5 'M/S'.
      const c0 = isStrictInt(r0[0]);
      const c1 = isStrictInt(r0[1]);
      const c2 = isStrictInt(r0[2]);

      // First LIF row is a header if columns 0..2 are strict integers and column 3 has event text.
      if (c0 && c1 && c2 && (r0[3] || '').trim().length > 0) {
        heatFilter = Number.parseInt(r0[2], 10);
        startIdx = 1;
        lifCompletedClock = this.extractLifCompletedClock(r0);

        // Look for Global Wind
        for (let k = 0; k < r0.length; k++) {
          const val = r0[k]?.trim().toUpperCase();

          // Case 1: "M/S" indicator
          if (val === 'M/S' && k > 0) {
            const w = this.parseLifNumber(r0[k - 1]);
            if (w !== null) globalWind = w;
          }

          // Case 2: Just a wind value like "+1.3" in early columns (e.g. col 4)
          if (globalWind === null && k >= 4 && k <= 6) {
            const cell = r0[k]?.trim();
            if (
              cell &&
              (cell.startsWith('+') ||
                cell.startsWith('-') ||
                cell.includes('.') ||
                cell.includes(',') ||
                cell === '0')
            ) {
              const w = this.parseLifNumber(cell);
              if (w !== null && w > -20 && w < 20) {
                globalWind = w;
              }
            }
          }
        }
      } else if (r0.length < 10 && c2) {
        // Fallback for older format
        heatFilter = Number.parseInt(r0[2], 10);
        startIdx = 1;
        lifCompletedClock = this.extractLifCompletedClock(r0);
      }
    }

    let importedCount = 0;

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const place = parseInt(row[0]);
      if (isNaN(place)) continue;

      const bib = row[1];
      const lane = parseInt(row[2]);
      // Time usually near col 6
      const time = row[6];

      // Wind in track LIF is heat-level value from header.
      // We prioritize the header value and only use row-level fallback when header lacks wind.
      let wind: number | null = globalWind;
      if (wind === null) {
        wind = this.extractRowWindFallback(row);
      }

      const entry = await prisma.entry.findFirst({
        where: {
          eventId,
          bib,
        },
      });

      if (entry) {
        await prisma.result.upsert({
          where: { entryId: entry.id },
          update: {
            place,
            time,
            wind,
            status: 'OK',
          },
          create: {
            entryId: entry.id,
            place,
            time,
            wind,
            status: 'OK',
          },
        });
        importedCount++;
      }
    }

    if (
      importedCount > 0 &&
      lifCompletedClock &&
      this.shouldUpdateCompletedClock(eventMeta?.completedTime, lifCompletedClock)
    ) {
      await prisma.event.update({
        where: { id: eventId },
        data: { completedTime: lifCompletedClock },
      });
    }

    return { imported: importedCount, heat: heatFilter };
  }

  async importEvt(eventId: string, fileBuffer: Buffer) {
    const content = iconv.decode(fileBuffer, 'windows-1250');
    const parsed = Papa.parse(content, { header: false, skipEmptyLines: true });

    const rows = parsed.data as string[][];
    if (rows.length === 0) return { imported: 0 };

    let importedCount = 0;
    let currentHeat = 1;

    for (const row of rows) {
      // Check if this is a header row (EventNum, Round, Heat, Name)
      if (row.length >= 4 && row[0] !== '' && !isNaN(parseInt(row[0]))) {
        currentHeat = parseInt(row[2]) || 1;
        continue;
      }

      // Participant row (,Bib,Lane,Last,First,Club)
      if (row[0] === '' && row[1]) {
        const bib = row[1];
        const lane = parseInt(row[2]);

        const entry = await (this.prisma as any).entry.findFirst({
          where: { eventId, bib },
        });

        if (entry) {
          await (this.prisma as any).entry.update({
            where: { id: entry.id },
            data: {
              heat: currentHeat,
              lane: lane || null,
              status: 'CONFIRMED',
            },
          });
          importedCount++;
        }
      }
    }

    return { imported: importedCount };
  }

  async findByEvent(eventId: string) {
    const prisma = this.prisma as any;

    // First get event details for points calculation and sub-event check
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { subEvents: true },
    });

    if (!event) return [];

    // Check if this is a main Multi-Event (has subEvents)
    if (event.subEvents && event.subEvents.length > 0) {
      return this.aggregateMultiEventPoints(event);
    }

    // We fetch all entries for this event and include their result
    const entries = await prisma.entry.findMany({
      where: { eventId },
      include: {
        result: true,
      },
      orderBy: [{ heat: 'asc' }, { lane: 'asc' }],
    });

    return entries.map((entry: any) => {
      const { result, ...entryData } = entry;

      let points = result?.points || null;
      if (
        result &&
        points === null &&
        (result.time || result.resultRounded || result.bestResult)
      ) {
        const val = result.time || result.bestResult || result.resultRounded;
        if (event && val) {
          const code = event.eventCode || event.code;
          const gender = entry.gender || event.gender;
          points = this.pointsService.calculate(code, val, gender);
        }
      }

      if (result) {
        return {
          ...result,
          points,
          entry: entryData,
        };
      }
      return {
        id: `placeholder-${entry.id}`,
        place: null,
        time: null,
        wind: null,
        status: 'START_LIST',
        points: null,
        entry: entryData,
      };
    });
  }

  async aggregateMultiEventPoints(parentEvent: any) {
    const prisma = this.prisma as any;

    // Sort sub-events by startTime (if set) then by creation order — like MDB's NW column
    const orderedSubEvents = [...parentEvent.subEvents].sort((a: any, b: any) => {
      if (a.startTime && b.startTime) {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const subEventIds = orderedSubEvents.map((se: any) => se.id);

    const parentEntries = await prisma.entry.findMany({
      where: { eventId: parentEvent.id },
      include: { athlete: true },
    });

    const subEntries = await prisma.entry.findMany({
      where: { eventId: { in: subEventIds } },
      include: { result: true, event: true },
    });

    // DNF statuses — only DNS and DQ disqualify the entire multi-event
    // NM (no mark) = 0 points for that event, athlete continues
    const DNF_STATUSES = ['DNS', 'DQ'];
    // Statuses that give 0 points but do NOT disqualify from multi-event
    const ZERO_PT_STATUSES = ['NM', 'DNF'];

    const results = parentEntries.map((pe: any) => {
      // For each ordered sub-event, find matching entry (by bib or name)
      const subEventDetails: any[] = [];
      let isDNF = false;
      let cumulativePoints = 0;

      for (const subEvent of orderedSubEvents) {
        const se = subEntries.find(
          (e: any) =>
            e.eventId === subEvent.id &&
            ((pe.bib && e.bib === pe.bib) || pe.athleteName === e.athleteName),
        );

        if (!se) {
          // No entry in this sub-event — treat as not yet competed (0 pts)
          subEventDetails.push({
            eventName: subEvent.name,
            eventCode: subEvent.code,
            performance: '-',
            points: 0,
            cumulativeAfter: cumulativePoints,
            status: null,
          });
          continue;
        }

        const resultStatus = se.result?.status?.toUpperCase();

        // DNS / DQ → whole multi-event is DNF
        if (resultStatus && DNF_STATUSES.includes(resultStatus)) {
          isDNF = true;
          subEventDetails.push({
            eventName: se.event.name,
            eventCode: se.event.code,
            performance: resultStatus,
            points: 0,
            cumulativeAfter: cumulativePoints,
            status: resultStatus,
          });
          continue;
        }

        // NM / DNF in sub-event → 0 pkt, ale zawodnik kontynuuje wielobój
        if (resultStatus && ZERO_PT_STATUSES.includes(resultStatus)) {
          subEventDetails.push({
            eventName: se.event.name,
            eventCode: se.event.code,
            performance: resultStatus,
            points: 0,
            cumulativeAfter: cumulativePoints,
            status: resultStatus,
          });
          continue;
        }

        let points = se.result?.points ?? null;
        if (
          points === null &&
          se.result &&
          (se.result.time || se.result.bestResult || se.result.resultRounded)
        ) {
          points = this.pointsService.calculate(
            se.event.eventCode || se.event.code,
            se.result.time || se.result.bestResult || se.result.resultRounded,
            se.gender || se.event.gender,
          );
        }

        const pts = points ?? 0;
        cumulativePoints += pts;

        subEventDetails.push({
          eventName: se.event.name,
          eventCode: se.event.code,
          performance: se.result?.time || se.result?.bestResult || '-',
          points: pts,
          cumulativeAfter: cumulativePoints,
          status: resultStatus || 'OK',
        });
      }

      const totalPoints = isDNF ? 0 : subEventDetails.reduce(
        (sum: number, det: any) => sum + det.points,
        0,
      );

      return {
        id: `overall-${pe.id}`,
        totalPoints,
        details: subEventDetails,
        isOverall: true,
        isDNF,
        entry: pe,
        place: 0,
      };
    });

    // DNF athletes sort to the bottom, then by totalPoints desc
    const sorted = results.sort((a: any, b: any) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return b.totalPoints - a.totalPoints;
    });

    let place = 1;
    sorted.forEach((r: any) => {
      if (r.isDNF) {
        r.place = null;
      } else {
        r.place = place++;
      }
    });

    return sorted;
  }

  findAll() {
    const prisma = this.prisma as any;
    return prisma.result.findMany({
      include: { entry: true },
    });
  }

  findOne(id: string) {
    const prisma = this.prisma as any;
    return prisma.result.findUnique({
      where: { id },
      include: { entry: true },
    });
  }

  async update(id: string, updateResultDto: any) {
    const prisma = this.prisma as any;
    let entryId: string | null = null;
    let resultId: string | null = id;

    if (id.startsWith('placeholder-')) {
      entryId = id.replace('placeholder-', '');
      // Try to find if result ALREADY exists even if frontend thinks it's a placeholder
      const res = await prisma.result.findUnique({ where: { entryId } });
      if (res) {
        resultId = res.id;
      } else {
        resultId = null; // We need to create it
      }
    }

    // Fetch existing info if we have a resultId, or from entry if we have entryId
    let existing: any = null;
    if (resultId) {
      existing = await prisma.result.findUnique({
        where: { id: resultId },
        include: { entry: { include: { event: true } } },
      });
    } else if (entryId) {
      const entry = await prisma.entry.findUnique({
        where: { id: entryId },
        include: { event: true },
      });
      if (entry) {
        existing = { entry }; // Mock existing to get ec and g
      }
    }

    if (existing) {
      const e = existing.entry;
      const ec = e.event.eventCode || e.event.code;
      const g = e.gender || e.event.gender;

      this.logger.debug(
        `update(${id}): eventCode=${ec}, gender=${g}, dto=${JSON.stringify(updateResultDto)}`,
      );

      const fieldsToFormat = [
        'time',
        'round1Result',
        'round2Result',
        'round3Result',
        'round4Result',
        'round5Result',
        'round6Result',
        'bestResult',
      ];
      for (const field of fieldsToFormat) {
        if (
          updateResultDto[field] !== undefined &&
          updateResultDto[field] !== null
        ) {
          const oldVal = updateResultDto[field];
          const newVal = this.formatDigitalResult(oldVal, ec, g);
          if (oldVal !== newVal) {
            updateResultDto[field] = newVal;
          }
        }
      }

      // Intelligent Wind Formatting
      if (updateResultDto.wind !== undefined) {
        updateResultDto.wind = this.formatWindValue(updateResultDto.wind);
      }

      const windFields = [
        'round1Wind',
        'round2Wind',
        'round3Wind',
        'round4Wind',
        'round5Wind',
        'round6Wind',
      ];
      for (const wf of windFields) {
        if (updateResultDto[wf] !== undefined) {
          updateResultDto[wf] = this.formatWindValue(updateResultDto[wf]);
        }
      }

      // If updating rounds, also calculate the best result
      const roundFields = [
        'round1Result',
        'round2Result',
        'round3Result',
        'round4Result',
        'round5Result',
        'round6Result',
      ];
      const isUpdatingRounds = roundFields.some(
        (f) => updateResultDto[f] !== undefined,
      );

      if (isUpdatingRounds) {
        const allRounds = roundFields.map((f) =>
          updateResultDto[f] !== undefined ? updateResultDto[f] : existing[f],
        );
        const numericValues = allRounds
          .map((r) => (r ? parseFloat(r.toString().replace(',', '.')) : 0))
          .filter((v) => !isNaN(v) && v > 0);

        if (numericValues.length > 0) {
          updateResultDto.bestResult = Math.max(...numericValues).toFixed(2);
        }
        this.logger.debug(
          `update(${id}): bestResult calculated from rounds: ${JSON.stringify(allRounds)} -> bestResult=${updateResultDto.bestResult}`,
        );
      }

      this.logger.debug(
        `update(${id}): formatted dto=${JSON.stringify(updateResultDto)}`,
      );
    } else {
      this.logger.warn(
        `update(${id}): existing not found! resultId=${resultId}, entryId=${entryId}. Formatting will NOT be applied.`,
      );
    }

    let updated: any;
    if (resultId) {
      updated = await prisma.result.update({
        where: { id: resultId },
        data: updateResultDto,
        include: { entry: { include: { event: true } } },
      });
    } else {
      updated = await prisma.result.create({
        data: {
          ...updateResultDto,
          entryId: entryId!,
          status: 'OK',
        },
        include: { entry: { include: { event: true } } },
      });
    }

    // Auto-calculate points if we have scoring parameters for this event
    const ec = updated.entry.event.eventCode || updated.entry.event.code;
    const g = updated.entry.gender || updated.entry.event.gender;
    const val = updated.time || updated.bestResult || updated.resultRounded;

    if (val) {
      const points = this.pointsService.calculate(ec, val, g);
      if (points !== null) {
        await prisma.result.update({
          where: { id: updated.id },
          data: { points },
        });
        updated.points = points;
      }
    }

    return updated;
  }

  async updateHeatWind(eventId: string, heat: number, wind: any) {
    const prisma = this.prisma as any;
    const finalWind = this.formatWindValue(wind);

    if (finalWind === null) return { count: 0 };

    const entries = await prisma.entry.findMany({
      where: { eventId, heat },
      select: { id: true },
    });

    const entryIds = entries.map((e: any) => e.id);

    // UPSERT or UPDATE results for these entries
    for (const eid of entryIds) {
      await prisma.result.upsert({
        where: { entryId: eid },
        update: { wind: finalWind },
        create: { entryId: eid, wind: finalWind, status: 'OK' },
      });
    }

    return { count: entryIds.length, wind: finalWind };
  }

  remove(id: string) {
    const prisma = this.prisma as any;
    return prisma.result.delete({
      where: { id },
    });
  }

  private formatWindValue(val: any): number | null {
    if (val === undefined || val === null || val === '') return null;
    const w = val.toString().trim().replace(',', '.');
    if (/^[+-]?\d+$/.test(w) && w.length >= 2 && !w.includes('.')) {
      const sign = w.startsWith('-') ? '-' : w.startsWith('+') ? '+' : '';
      const abs = w.replace(/[+-]/, '');
      if (abs.length >= 2) {
        return parseFloat(`${sign}${abs.slice(0, -1)}.${abs.slice(-1)}`);
      }
    }
    const res = parseFloat(w);
    return isNaN(res) ? null : res;
  }

  private formatDigitalResult(
    val: any,
    eventCode: string,
    gender: string,
  ): any {
    if (typeof val !== 'string') return val;
    const cleaned = val.trim();
    if (!/^\d+$/.test(cleaned) || cleaned.length < 3) return cleaned;

    const normCode = this.pointsService.normalizeEventCode(eventCode);
    const genderPrefix =
      gender === 'K' || gender === 'F' || gender === 'W' || gender === 'KOBIETY'
        ? 'K'
        : 'M';
    const key = `${genderPrefix}_${normCode}`;
    const params = (this.pointsService.CONSTANTS as any)[key];

    if (!params) {
      // Universal fallback for numeric input without specific params
      return `${cleaned.slice(0, -2)}.${cleaned.slice(-2)}`;
    }

    if (params.type === 'track') {
      // Logic for track events
      // 3 digits: 912 -> 9.12
      // 4 digits: 1034 -> 10.34
      // 5 digits: 12015 -> 1:20.15
      // 6 digits: 115200 -> 11:52.00

      if (cleaned.length === 3) return `${cleaned[0]}.${cleaned.slice(1)}`;
      if (cleaned.length === 4)
        return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
      if (cleaned.length === 5)
        return `${cleaned[0]}:${cleaned.slice(1, 3)}.${cleaned.slice(3)}`;
      if (cleaned.length === 6)
        return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}.${cleaned.slice(4)}`;
    } else {
      // field, throw, jump: always X.YY
      if (cleaned.length === 3) return `${cleaned[0]}.${cleaned.slice(1)}`;
      if (cleaned.length === 4)
        return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
      if (cleaned.length === 5)
        return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    }
    return cleaned;
  }

  private extractLifCompletedClock(headerRow: string[]): string | null {
    if (!Array.isArray(headerRow) || headerRow.length === 0) return null;

    for (let i = headerRow.length - 1; i >= 0; i--) {
      const raw = (headerRow[i] || '').trim();
      if (!raw) continue;

      const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?$/);
      if (!match) continue;

      const hh = Number(match[1]);
      const mm = Number(match[2]);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) continue;

      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    return null;
  }

  private shouldUpdateCompletedClock(
    existingClock?: string | null,
    nextClock?: string | null,
  ) {
    if (!nextClock) return false;
    if (!existingClock) return true;

    const [eH, eM] = existingClock.split(':').map((v) => Number(v));
    const [nH, nM] = nextClock.split(':').map((v) => Number(v));
    if ([eH, eM, nH, nM].some((v) => Number.isNaN(v))) {
      return true;
    }
    return nH * 60 + nM >= eH * 60 + eM;
  }

  private parseLifNumber(value?: string | null): number | null {
    if (!value) return null;
    const normalized = value.trim().replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
    return parsed;
  }

  private extractRowWindFallback(row: string[]): number | null {
    if (!Array.isArray(row) || row.length < 8) return null;

    // Row fallback is intentionally strict to avoid taking random numeric fields.
    const candidates = [7, 8, 9, 10, 11];
    for (const idx of candidates) {
      if (idx >= row.length) continue;
      const parsed = this.parseStrictWindToken(row[idx]);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private parseStrictWindToken(value?: string | null): number | null {
    if (!value) return null;
    const token = value.trim().toUpperCase();
    if (!token || token === 'M/S') return null;

    // Accept normal wind notation from LIF: +1.3 / -0.4 / 0.0 (one decimal place).
    if (!/^[+-]?\d{1,2}(?:[.,]\d)?$/.test(token)) return null;

    const parsed = this.parseLifNumber(token);
    if (parsed === null) return null;
    if (parsed <= -20 || parsed >= 20) return null;
    return parsed;
  }
}
