import * as iconv from 'iconv-lite';

type SupportedEncoding = 'utf-8' | 'windows-1250' | 'iso-8859-2';

type DecodedCandidate = {
  encoding: SupportedEncoding;
  text: string;
  score: number;
};

const ENCODINGS: SupportedEncoding[] = ['utf-8', 'windows-1250', 'iso-8859-2'];

export function decodeTextBuffer(buffer: Buffer): string {
  const candidates = ENCODINGS.map((encoding) => {
    const text = decodeByEncoding(buffer, encoding);
    return {
      encoding,
      text,
      score: scoreDecodedText(text),
    };
  });

  candidates.sort(compareCandidates);
  return candidates[0].text;
}

function compareCandidates(a: DecodedCandidate, b: DecodedCandidate): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  return ENCODINGS.indexOf(a.encoding) - ENCODINGS.indexOf(b.encoding);
}

function decodeByEncoding(buffer: Buffer, encoding: SupportedEncoding): string {
  if (encoding === 'utf-8') {
    return buffer.toString('utf-8');
  }
  return iconv.decode(buffer, encoding);
}

function scoreDecodedText(value: string): number {
  let score = 0;

  const replacementChars = (value.match(/\uFFFD/g) || []).length;
  score -= replacementChars * 8;

  const mojibakeMarkers = (value.match(/[ÃÅÄÂÐÑ][^\s,;]*/g) || []).length;
  score -= mojibakeMarkers * 5;

  const polishChars = (value.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
  score += polishChars * 2;

  const printable = (
    value.match(/[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ,.;:()\-_\s]/g) || []
  ).length;
  const ratio = value.length > 0 ? printable / value.length : 1;
  score += Math.round(ratio * 20);

  return score;
}
