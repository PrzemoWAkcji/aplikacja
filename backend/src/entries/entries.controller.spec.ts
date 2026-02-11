import { Test, TestingModule } from '@nestjs/testing';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

describe('EntriesController', () => {
  let controller: EntriesController;
  let service: EntriesService;

  const mockEntriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findByEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntriesController],
      providers: [
        {
          provide: EntriesService,
          useValue: mockEntriesService,
        },
      ],
    }).compile();

    controller = module.get<EntriesController>(EntriesController);
    service = module.get<EntriesService>(EntriesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
