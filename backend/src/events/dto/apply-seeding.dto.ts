import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ApplySeedingEntryDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsOptional()
  @IsInt()
  heat?: number | null;

  @IsOptional()
  @IsInt()
  lane?: number | null;
}

export class ApplySeedingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplySeedingEntryDto)
  entries!: ApplySeedingEntryDto[];
}
