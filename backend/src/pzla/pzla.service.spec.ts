import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { PzlaService } from './pzla.service';
import { SB_HTML_WITH_POLISH_ROWS } from '../test-fixtures/encoding.fixtures';

describe('PzlaService', () => {
  let service: PzlaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PzlaService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PzlaService>(PzlaService);
  });

  it('parses SB rows with Polish event names and values', () => {
    const sb = (service as any).extractSbResultsFromHtml(
      SB_HTML_WITH_POLISH_ROWS,
    );

    expect(sb['Pchnięcie kulą']).toBe('16,45');
    expect(sb['Mila']).toBe('4:02.11');
  });

  it('parses numeric result with comma as decimal separator', () => {
    expect((service as any).parseResultValue('16,45')).toBeCloseTo(16.45, 2);
  });

  it('classifies technical event as higher-is-better comparison', () => {
    expect((service as any).isTimeEvent('Pchnięcie kulą')).toBe(false);
    expect(
      (service as any).compareResults('16,45', '16,20', 'Pchnięcie kulą'),
    ).toBe('16,45');
  });
});
