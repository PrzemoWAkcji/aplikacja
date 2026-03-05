import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(
    /^"|"$/g,
    '',
  );
}

const runningInDocker = fs.existsSync('/.dockerenv');
if (!runningInDocker && process.env.DATABASE_URL?.includes('@postgres:')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    '@postgres:',
    '@localhost:',
  );
}

type ModelConfig = {
  model: 'meeting' | 'event' | 'entry' | 'athlete';
  fields: string[];
};

type RepairSummary = {
  scanned: number;
  changedRows: number;
  changedFields: number;
};

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');

const modelConfigs: ModelConfig[] = [
  {
    model: 'meeting',
    fields: ['name', 'location', 'city', 'country'],
  },
  {
    model: 'event',
    fields: [
      'name',
      'code',
      'eventCode',
      'ageGroup',
      'stage',
      'model',
      'trialsMode',
      'heights',
      'advancementRule',
    ],
  },
  {
    model: 'entry',
    fields: [
      'athleteName',
      'firstName',
      'middleName',
      'lastName',
      'bib',
      'club',
      'countryCode',
      'tilastopajaId',
      'entryId',
      'startListId',
      'pb',
      'sb',
      'seedingResult',
      'relaySquad',
    ],
  },
  {
    model: 'athlete',
    fields: [
      'firstName',
      'lastName',
      'athleteName',
      'gender',
      'club',
      'countryCode',
      'pb',
      'sb',
    ],
  },
];

function hasMojibakeMarkers(value: string): boolean {
  return /[ÃÅÄÂÐÑ]/.test(value) || /\uFFFD/.test(value);
}

function scoreText(value: string): number {
  let score = 0;

  const replacementChars = (value.match(/\uFFFD/g) || []).length;
  score -= replacementChars * 12;

  const mojibakeMarkers = (value.match(/[ÃÅÄÂÐÑ][^\s,;]*/g) || []).length;
  score -= mojibakeMarkers * 6;

  const polishChars = (value.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
  score += polishChars * 3;

  const printable = (value.match(/[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ,.;:()\-_\s]/g) || [])
    .length;
  const ratio = value.length > 0 ? printable / value.length : 1;
  score += Math.round(ratio * 25);

  return score;
}

function decodeLatin1AsUtf8(value: string): string {
  return Buffer.from(value, 'latin1').toString('utf8');
}

function maybeRepairValue(value: string): string | null {
  if (!value || !hasMojibakeMarkers(value)) {
    return null;
  }

  let best = value;
  let bestScore = scoreText(value);
  let current = value;

  for (let i = 0; i < 2; i++) {
    const decoded = decodeLatin1AsUtf8(current);
    if (!decoded || decoded === current) {
      break;
    }

    const decodedScore = scoreText(decoded);
    if (decodedScore > bestScore) {
      best = decoded;
      bestScore = decodedScore;
    }

    current = decoded;
  }

  if (best !== value && bestScore >= scoreText(value) + 2) {
    return best;
  }

  return null;
}

async function repairModel(config: ModelConfig): Promise<RepairSummary> {
  const delegate = (prisma as any)[config.model];
  const select = config.fields.reduce(
    (acc, field) => ({ ...acc, [field]: true }),
    { id: true } as Record<string, true>,
  );

  const rows: Array<Record<string, unknown>> = await delegate.findMany({
    select,
  });

  const summary: RepairSummary = {
    scanned: rows.length,
    changedRows: 0,
    changedFields: 0,
  };

  for (const row of rows) {
    const updates: Record<string, string> = {};

    for (const field of config.fields) {
      const current = row[field];
      if (typeof current !== 'string') continue;

      const repaired = maybeRepairValue(current);
      if (repaired !== null) {
        updates[field] = repaired;
      }
    }

    if (Object.keys(updates).length === 0) {
      continue;
    }

    summary.changedRows += 1;
    summary.changedFields += Object.keys(updates).length;

    if (applyChanges) {
      await delegate.update({
        where: { id: row.id as string },
        data: updates,
      });
    }
  }

  return summary;
}

async function main() {
  console.log(
    applyChanges
      ? 'Running mojibake repair in APPLY mode.'
      : 'Running mojibake repair in DRY-RUN mode.',
  );

  for (const config of modelConfigs) {
    const result = await repairModel(config);
    console.log(
      `${config.model}: scanned=${result.scanned}, changedRows=${result.changedRows}, changedFields=${result.changedFields}`,
    );
  }

  if (!applyChanges) {
    console.log('No database rows were updated. Re-run with --apply to persist.');
  }
}

main()
  .catch((error) => {
    console.error('Repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
