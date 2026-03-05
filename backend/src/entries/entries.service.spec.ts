import { Test, TestingModule } from '@nestjs/testing';
import { EntriesService } from './entries.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EntriesService', () => {
  let service: EntriesService;
  const mockPrismaService = {
    athlete: {},
    entry: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EntriesService>(EntriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
