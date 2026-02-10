import { Test, TestingModule } from '@nestjs/testing';
import { FileMappingService } from './file-mapping.service';

describe('FileMappingService', () => {
  let service: FileMappingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileMappingService],
    }).compile();

    service = module.get<FileMappingService>(FileMappingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
