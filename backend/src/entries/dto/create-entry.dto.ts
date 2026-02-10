import { EntryStatus } from '@prisma/client';

export class CreateEntryDto {
    athleteName: string;
    bib?: string;
    eventId: string;
    status?: EntryStatus;
}
