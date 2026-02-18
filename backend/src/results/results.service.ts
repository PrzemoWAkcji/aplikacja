import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import * as iconv from 'iconv-lite';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) { }

  async importLif(eventId: string, fileBuffer: Buffer) {
    const content = iconv.decode(fileBuffer, 'windows-1250');
    const parsed = Papa.parse(content, { header: false, skipEmptyLines: true });

    const rows = parsed.data as string[][];
    if (rows.length === 0) return { imported: 0 };

    let startIdx = 0;
    let heatFilter: number | null = null;

    if (rows[0] && rows[0].length < 10) {
      heatFilter = parseInt(rows[0][2]);
      startIdx = 1;
    }

    let importedCount = 0;
    const prisma = this.prisma as any;

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const place = parseInt(row[0]);
      if (isNaN(place)) continue;

      const bib = row[1];
      const lane = parseInt(row[2]);
      const time = row[6];
      const windRaw = parseFloat(row[row.length - 1]);
      const wind = isNaN(windRaw) ? null : windRaw;

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
      if (row.length >= 4 && row[0] !== "" && !isNaN(parseInt(row[0]))) {
        currentHeat = parseInt(row[2]) || 1;
        continue;
      }

      // Participant row (,Bib,Lane,Last,First,Club)
      if (row[0] === "" && row[1]) {
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
              status: 'CONFIRMED'
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
    // We fetch all entries for this event and include their result
    // This allows showing start lists (entries) even if results aren't processed yet
    const entries = await prisma.entry.findMany({
      where: { eventId },
      include: {
        result: true
      },
      orderBy: [
        { heat: 'asc' },
        { lane: 'asc' }
      ]
    });

    // Map to a consistent format where we have result data with entry attached
    // To maintain compatibility with existing frontend expectations:
    return entries.map((entry: any) => {
      const { result, ...entryData } = entry;
      if (result) {
        return {
          ...result,
          entry: entryData
        };
      }
      // If no result, return a placeholder result object
      return {
        id: `placeholder-${entry.id}`,
        place: null,
        time: null,
        wind: null,
        status: 'START_LIST',
        entry: entryData
      };
    });
  }

  findAll() {
    const prisma = this.prisma as any;
    return prisma.result.findMany({
      include: { entry: true }
    });
  }

  findOne(id: string) {
    const prisma = this.prisma as any;
    return prisma.result.findUnique({
      where: { id },
      include: { entry: true }
    });
  }

  async update(id: string, updateResultDto: any) {
    const prisma = this.prisma as any;
    return prisma.result.update({
      where: { id },
      data: updateResultDto,
      include: { entry: true }
    });
  }

  remove(id: string) {
    const prisma = this.prisma as any;
    return prisma.result.delete({
      where: { id }
    });
  }
}
