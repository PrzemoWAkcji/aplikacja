import { Test, TestingModule } from '@nestjs/testing';
import { ResultsProcessor } from './results.processor';
import { ResultsService } from './results.service';
import { ResultsGateway } from './results.gateway';
import { Job } from 'bullmq';

describe('ResultsProcessor', () => {
  let processor: ResultsProcessor;
  let resultsService: ResultsService;
  let resultsGateway: ResultsGateway;

  const mockResultsService = {
    importLif: jest.fn(),
  };

  const mockResultsGateway = {
    broadcastUpdate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsProcessor,
        {
          provide: ResultsService,
          useValue: mockResultsService,
        },
        {
          provide: ResultsGateway,
          useValue: mockResultsGateway,
        },
      ],
    }).compile();

    processor = module.get<ResultsProcessor>(ResultsProcessor);
    resultsService = module.get<ResultsService>(ResultsService);
    resultsGateway = module.get<ResultsGateway>(ResultsGateway);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should handle import-lif job successfully', async () => {
      const job = {
        name: 'import-lif',
        id: '1',
        data: {
          eventId: 'event-123',
          fileBuffer: { type: 'Buffer', data: [1, 2, 3] },
        },
      } as Job;

      const expectedResult = { imported: 5, heat: 1 };
      mockResultsService.importLif.mockResolvedValue(expectedResult);

      const result = await processor.process(job);

      expect(mockResultsService.importLif).toHaveBeenCalledWith(
        'event-123',
        expect.any(Buffer),
      );
      expect(mockResultsGateway.broadcastUpdate).toHaveBeenCalledWith(
        'event-123',
        expect.objectContaining({
          imported: 5,
          heat: 1,
        }),
      );
      expect(result).toEqual(expectedResult);
    });

    it('should log warning for unknown job', async () => {
      const job = {
        name: 'unknown-job',
        id: '2',
        data: {},
      } as Job;

      const result = await processor.process(job);
      expect(result).toBeUndefined();
      expect(mockResultsService.importLif).not.toHaveBeenCalled();
    });
  });
});
