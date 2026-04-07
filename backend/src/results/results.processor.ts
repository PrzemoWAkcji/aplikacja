import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsGateway } from './results.gateway';
import { BroadcastGateway } from '../broadcast/broadcast.gateway';
import { BroadcastService } from '../broadcast/broadcast.service';

@Processor('results-queue')
export class ResultsProcessor extends WorkerHost {
  private readonly logger = new Logger(ResultsProcessor.name);

  constructor(
    private readonly resultsService: ResultsService,
    private readonly resultsGateway: ResultsGateway,
    @Inject(forwardRef(() => BroadcastGateway))
    private readonly broadcastGateway: BroadcastGateway,
    @Inject(forwardRef(() => BroadcastService))
    private readonly broadcastService: BroadcastService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.debug(`Processing job ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case 'import-lif':
        return this.handleImportLif(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleImportLif(job: Job) {
    const { eventId, fileBuffer } = job.data;

    // Redis serializes Buffers to { type: 'Buffer', data: [...] }
    const buffer = Buffer.from(fileBuffer.data);

    this.logger.log(`Processing LIF import for event ${eventId}`);

    try {
      const result = await this.resultsService.importLif(eventId, buffer);

      this.resultsGateway.broadcastUpdate(eventId, {
        imported: result.imported,
        heat: result.heat,
        timestamp: new Date().toISOString(),
      });

      // Also push to broadcast clients
      await this.pushBroadcastUpdate(eventId);

      this.logger.log(`Job completed: Imported ${result.imported} results`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process LIF import: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async pushBroadcastUpdate(eventId: string) {
    try {
      const prisma = (this.resultsService as any).prisma;
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { meetingId: true },
      });

      if (event?.meetingId) {
        const payload = await this.broadcastService.getGraphicData(
          event.meetingId,
          eventId,
          'results_table',
        );
        this.broadcastGateway.sendUpdate(event.meetingId, payload);
      }
    } catch (error) {
      this.logger.warn(`Failed to push broadcast update: ${error.message}`);
    }
  }
}
