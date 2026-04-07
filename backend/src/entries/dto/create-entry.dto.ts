import { EntryStatus } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

const VALID_STATUSES: EntryStatus[] = ['PENDING', 'CONFIRMED', 'SCRATCHED'];

export class CreateEntryDto {
  @IsString()
  @MaxLength(200)
  athleteName: string;

  @IsUUID()
  eventId: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  bib?: string;

  @IsOptional()
  @IsIn(VALID_STATUSES)
  status?: EntryStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  heat?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  lane?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  club?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pb?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sb?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | Date;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearOfBirth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tilastopajaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  startListId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  seedingResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  relaySquad?: string; // JSON array of relay members
}
