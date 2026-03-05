import { Test, TestingModule } from '@nestjs/testing';
import * as iconv from 'iconv-lite';
import { HttpService } from '@nestjs/axios';
import { FileMappingService } from './file-mapping.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntriesService } from '../entries/entries.service';
import {
  FEDERATION_IMPORT_CSV,
  STARTER_MEETING_LIST_CSV,
} from '../test-fixtures/encoding.fixtures';

describe('FileMappingService', () => {
  let service: FileMappingService;
  let mockEntriesService: { create: jest.Mock };

  const mockPrismaService = {
    meeting: {
      findUnique: jest.fn().mockResolvedValue({
        syncOnlineEventNames: false,
      }),
    },
    event: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'event-1',
        name: '60 m mężczyzn',
        code: 'M60',
        gender: 'M',
      }),
    },
  };

  beforeEach(async () => {
    mockEntriesService = {
      create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileMappingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EntriesService,
          useValue: mockEntriesService,
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileMappingService>(FileMappingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decodes cp1250 meeting list with Polish city name', () => {
    const cp1250 = iconv.encode(STARTER_MEETING_LIST_CSV, 'windows-1250');
    const decoded = (service as any).decodeCsvContent(cp1250);
    const meetings = (service as any).parseStarterMeetingList(decoded);

    expect(meetings).toHaveLength(1);
    expect(meetings[0].name).toContain('Mistrzostwa');
    expect(meetings[0].location).toBe('Łódź');
  });

  it('imports federation csv with Polish athlete and club names', async () => {
    const cp1250 = iconv.encode(FEDERATION_IMPORT_CSV, 'windows-1250');

    const result = await service.importFederationCsv('meeting-1', cp1250);

    expect(result.count).toBe(1);
    expect(mockEntriesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        athleteName: 'Łukasz Żółć',
        club: 'KS Łódź',
      }),
    );
  });
});
