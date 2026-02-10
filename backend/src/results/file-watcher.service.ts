import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { ResultsService } from './results.service';
import { ResultsGateway } from './results.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FileWatcherService implements OnModuleInit {
    private readonly logger = new Logger(FileWatcherService.name);
    private readonly watchDir = path.join(process.cwd(), 'lynx_data');

    constructor(
        private resultsService: ResultsService,
        private resultsGateway: ResultsGateway,
        private prisma: PrismaService,
    ) {
        if (!fs.existsSync(this.watchDir)) {
            fs.mkdirSync(this.watchDir, { recursive: true });
        }
    }

    onModuleInit() {
        this.logger.log(`Starting file watcher on: ${this.watchDir}`);

        // Watch for .lif files
        const watcher = chokidar.watch(this.watchDir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
        });

        watcher.on('add', (filePath) => this.handleFile(filePath));
        watcher.on('change', (filePath) => this.handleFile(filePath));
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
            const result = await this.resultsService.importLif(event.id, fileBuffer);

            this.logger.log(`Automatically imported ${result.imported} results for event ${event.name}`);

            // Broadcast update via WebSocket
            this.resultsGateway.broadcastUpdate(event.id, {
                imported: result.imported,
                heat: result.heat,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            this.logger.error(`Error processing automated LIF import: ${error.message}`);
        }
    }
}
