import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ResultsService } from './results.service';
import { ResultsGateway } from './results.gateway';
import { Logger } from '@nestjs/common';

@Processor('results-queue')
export class ResultsProcessor extends WorkerHost {
  private readonly logger = new Logger(ResultsProcessor.name);

  constructor(
    private readonly resultsService: ResultsService,
    private readonly resultsGateway: ResultsGateway,
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
        
        this.logger.log(`Job completed: Imported ${result.imported} results`);
        return result;
    } catch (error) {
        this.logger.error(`Failed to process LIF import: ${error.message}`, error.stack);
        throw error;
    }
  }
}
