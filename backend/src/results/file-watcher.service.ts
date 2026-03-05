import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

type FinishLynxMapFile = {
  entries?: Array<{
    eventNumber?: number;
    roundType?: number;
    heatNo?: number;
    eventId?: string;
    eventName?: string;
  }>;
};

@Injectable()
export class FileWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileWatcherService.name);
  private readonly watchDir = path.join(process.cwd(), 'lynx_data');
  private watcher: chokidar.FSWatcher | null = null;

  constructor(
    @InjectQueue('results-queue') private resultsQueue: Queue,
    private prisma: PrismaService,
  ) {
    if (!fs.existsSync(this.watchDir)) {
      fs.mkdirSync(this.watchDir, { recursive: true });
    }
  }

  onModuleInit() {
    this.logger.log(`Starting file watcher on: ${this.watchDir}`);

    // Watch for .lif files
    this.watcher = chokidar.watch(this.watchDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 1200,
        pollInterval: 200,
      },
    });

    this.watcher.on('add', (filePath) => this.handleFile(filePath));
    this.watcher.on('change', (filePath) => this.handleFile(filePath));
  }

  onModuleDestroy() {
    if (this.watcher) {
      this.watcher.close();
      this.logger.log('File watcher closed');
    }
  }

  private async handleFile(filePath: string) {
    if (!filePath.toLowerCase().endsWith('.lif')) return;

    this.logger.log(`Detected change in file: ${filePath}`);

    try {
      const fileName = path.basename(filePath, '.lif');
      const event = await this.resolveEventForLifFile(fileName);

      if (!event) {
        this.logger.warn(`No event found for LIF file: ${fileName}`);
        return;
      }

      const fileBuffer = fs.readFileSync(filePath);

      // Offload processing to BullMQ
      await this.resultsQueue.add('import-lif', {
        eventId: event.id,
        fileBuffer: fileBuffer,
      });

      this.logger.log(
        `Queued LIF import for event ${event.name} (File: ${fileName})`,
      );
    } catch (error) {
      this.logger.error(`Error queuing automated LIF import: ${error.message}`);
    }
  }

  private async resolveEventForLifFile(fileName: string) {
    const nameParts = fileName.split('-');
    const eventCode = (nameParts[0] || '').trim();

    if (eventCode) {
      const byCode = await this.prisma.event.findFirst({
        where: { code: eventCode },
      });
      if (byCode) {
        return byCode;
      }

      if (/^\d+$/.test(eventCode)) {
        const numericCode = String(parseInt(eventCode, 10));
        if (numericCode && numericCode !== eventCode) {
          const byNumericCode = await this.prisma.event.findFirst({
            where: { code: numericCode },
          });
          if (byNumericCode) {
            return byNumericCode;
          }
        }
      }
    }

    const parsed = this.parseLifFileName(fileName);
    if (!parsed) {
      return null;
    }

    const mapEntry = this.findEventInFinishLynxMap(
      parsed.eventNumber,
      parsed.roundType,
      parsed.heatNo,
    );

    if (mapEntry?.eventId) {
      const byMap = await this.prisma.event.findUnique({
        where: { id: mapEntry.eventId },
      });
      if (byMap) {
        return byMap;
      }
    }

    return this.findEventByLynxEvtHeader(
      parsed.eventNumber,
      parsed.roundType,
      parsed.heatNo,
    );
  }

  private parseLifFileName(fileName: string) {
    // FinishLynx format: eventNum-round-heat (e.g. 001-1-01)
    const match = fileName.match(/^(\d+)-(\d+)-(\d+)$/);
    if (!match) return null;

    return {
      eventNumber: parseInt(match[1], 10),
      roundType: parseInt(match[2], 10),
      heatNo: parseInt(match[3], 10),
    };
  }

  private findEventInFinishLynxMap(
    eventNumber: number,
    roundType: number,
    heatNo: number,
  ) {
    const mapPath = path.join(this.watchDir, 'Lynx.map.json');
    if (!fs.existsSync(mapPath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(mapPath, 'utf8');
      const parsed = JSON.parse(raw) as FinishLynxMapFile;
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

      return (
        entries.find(
          (entry) =>
            entry.eventNumber === eventNumber &&
            entry.roundType === roundType &&
            entry.heatNo === heatNo,
        ) ||
        entries.find((entry) => entry.eventNumber === eventNumber) ||
        null
      );
    } catch (error) {
      this.logger.warn(
        `Failed to parse Lynx.map.json: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async findEventByLynxEvtHeader(
    eventNumber: number,
    roundType: number,
    heatNo: number,
  ) {
    const evtPath = path.join(this.watchDir, 'Lynx.evt');
    if (!fs.existsSync(evtPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(evtPath, 'latin1');
      const lines = content.split(/\r?\n/).filter((line) => line.trim());

      let displayName = '';
      for (const line of lines) {
        if (line.startsWith(';')) continue;
        const cols = line.split(',');
        if (cols.length < 4) continue;

        const rowEventNumber = parseInt((cols[0] || '').trim(), 10);
        if (Number.isNaN(rowEventNumber)) continue;

        const rowRoundType = parseInt((cols[1] || '').trim(), 10);
        const rowHeatNo = parseInt((cols[2] || '').trim(), 10);

        if (
          rowEventNumber === eventNumber &&
          rowRoundType === roundType &&
          rowHeatNo === heatNo
        ) {
          displayName = (cols[3] || '').trim();
          break;
        }
      }

      if (!displayName) {
        return null;
      }

      const baseName = displayName
        .replace(/-Bieg\s+\d+$/i, '')
        .replace(/-SEMIFINAL\s+\d+$/i, '')
        .replace(/-FINAL\s+[A-Z0-9]+$/i, '')
        .replace(/-FINAL$/i, '')
        .trim();

      const byBaseName = await this.prisma.event.findFirst({
        where: { name: baseName || displayName },
      });
      if (byBaseName) {
        return byBaseName;
      }

      const byDisplayName = await this.prisma.event.findFirst({
        where: { name: displayName },
      });
      if (byDisplayName) {
        return byDisplayName;
      }

      const normalizedTarget = this.normalizeEventName(baseName || displayName);
      if (!normalizedTarget) {
        return null;
      }

      const candidates = await this.prisma.event.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      });
      const normalizedMatch = candidates.find(
        (candidate) => this.normalizeEventName(candidate.name) === normalizedTarget,
      );
      if (!normalizedMatch) {
        return null;
      }

      return this.prisma.event.findUnique({
        where: { id: normalizedMatch.id },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to parse Lynx.evt fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeEventName(value: string) {
    return (value || '')
      .toLowerCase()
      .replace(/\u0142/g, 'l')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
