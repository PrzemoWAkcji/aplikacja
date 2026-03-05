import { EntryStatus } from '@prisma/client';

export class CreateEntryDto {
  athleteName: string;
  bib?: string;
  eventId: string;
  status?: EntryStatus;
  heat?: number;
  lane?: number;
  club?: string;
  pb?: string;
  sb?: string;
  birthDate?: string | Date;
  yearOfBirth?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  gender?: string;
  countryCode?: string;
  tilastopajaId?: string;
  entryId?: string;
  startListId?: string;
  seedingResult?: string;
  relaySquad?: string; // JSON array of relay members
}
