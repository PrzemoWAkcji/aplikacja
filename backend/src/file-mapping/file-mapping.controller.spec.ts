import { Test, TestingModule } from '@nestjs/testing';
import { FileMappingController } from './file-mapping.controller';

describe('FileMappingController', () => {
  let controller: FileMappingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileMappingController],
    }).compile();

    controller = module.get<FileMappingController>(FileMappingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
