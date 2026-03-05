import { Test, TestingModule } from '@nestjs/testing';
import { FileMappingController } from './file-mapping.controller';
import { FileMappingService } from './file-mapping.service';

describe('FileMappingController', () => {
  let controller: FileMappingController;
  const mockFileMappingService = {
    exportStartListCsv: jest.fn(),
    exportFinishLynxEvt: jest.fn(),
    importFederationCsv: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileMappingController],
      providers: [
        {
          provide: FileMappingService,
          useValue: mockFileMappingService,
        },
      ],
    }).compile();

    controller = module.get<FileMappingController>(FileMappingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
