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
}
