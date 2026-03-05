import { Test, TestingModule } from '@nestjs/testing';
import { FileWatcherService } from './file-watcher.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('FileWatcherService', () => {
  let service: FileWatcherService;
  let queue: Queue;

  const mockQueue = {
    add: jest.fn(),
  };

  const mockPrismaService = {
    event: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileWatcherService,
        {
          provide: getQueueToken('results-queue'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FileWatcherService>(FileWatcherService);
    queue = module.get<Queue>(getQueueToken('results-queue'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Note: Testing actual file watching is hard in unit tests (integration test better).
  // But we can verify dependency injection worked.
});
