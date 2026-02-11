import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

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
            // Standard FinishLynx naming: eventNum-round-heat.lif (e.g. 001-1-01.lif)
            // We'll try to match by event code (event number)
            const fileName = path.basename(filePath, '.lif');
            const eventCode = fileName.split('-')[0];

            const event = await this.prisma.event.findFirst({
                where: { code: eventCode },
            });

            if (!event) {
                this.logger.warn(`No event found with code: ${eventCode}`);
                return;
            }

            const fileBuffer = fs.readFileSync(filePath);

            // Offload processing to BullMQ
            await this.resultsQueue.add('import-lif', {
                eventId: event.id,
                fileBuffer: fileBuffer,
            });

            this.logger.log(`Queued LIF import for event ${event.name} (File: ${fileName})`);

        } catch (error) {
            this.logger.error(`Error queuing automated LIF import: ${error.message}`);
        }
    }
}
