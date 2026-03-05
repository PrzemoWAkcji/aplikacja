import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

describe('MeetingsController', () => {
  let controller: MeetingsController;
  const mockMeetingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deleteAllEvents: jest.fn(),
    uploadLogo: jest.fn(),
    uploadSponsor: jest.fn(),
    removeLogo: jest.fn(),
    clearSponsors: jest.fn(),
    getUploadedFile: jest.fn(),
    getPrintData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetingsController],
      providers: [
        {
          provide: MeetingsService,
          useValue: mockMeetingsService,
        },
      ],
    }).compile();

    controller = module.get<MeetingsController>(MeetingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
