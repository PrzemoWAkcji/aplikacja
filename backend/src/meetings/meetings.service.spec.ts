import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsService } from './meetings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MeetingsService', () => {
  let service: MeetingsService;
  const mockPrismaService = {
    meeting: {},
    event: {},
    entry: {},
    result: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
