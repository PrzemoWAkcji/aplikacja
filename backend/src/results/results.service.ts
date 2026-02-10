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

  async findByEvent(eventId: string) {
    const prisma = this.prisma as any;
    return prisma.result.findMany({
      where: {
        entry: {
          eventId
        }
      },
      include: {
        entry: true
      },
      orderBy: [
        { entry: { heat: 'asc' } },
        { place: 'asc' }
      ]
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

  remove(id: string) {
    const prisma = this.prisma as any;
    return prisma.result.delete({
      where: { id }
    });
  }
}
