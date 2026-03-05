import * as iconv from 'iconv-lite';
import { decodeTextBuffer } from './text-decoder.util';
import { POLISH_DIACRITICS_SAMPLE } from '../test-fixtures/encoding.fixtures';

describe('decodeTextBuffer', () => {
  it('decodes utf-8 text with Polish characters', () => {
    const buffer = Buffer.from(POLISH_DIACRITICS_SAMPLE, 'utf-8');
    expect(decodeTextBuffer(buffer)).toContain('Zażółć');
    expect(decodeTextBuffer(buffer)).toContain('ąęśćłóńżź');
  });

  it('decodes windows-1250 text with Polish characters', () => {
    const buffer = iconv.encode(POLISH_DIACRITICS_SAMPLE, 'windows-1250');
    expect(decodeTextBuffer(buffer)).toContain('Zażółć');
    expect(decodeTextBuffer(buffer)).toContain('ĄĘŚĆŁÓŃŻŹ');
  });

  it('decodes iso-8859-2 text with Polish characters', () => {
    const buffer = iconv.encode(POLISH_DIACRITICS_SAMPLE, 'iso-8859-2');
    expect(decodeTextBuffer(buffer)).toContain('Zażółć');
    expect(decodeTextBuffer(buffer)).toContain('jaźń');
  });
});
