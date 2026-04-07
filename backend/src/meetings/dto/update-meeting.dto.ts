import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  domtelMeetingCode?: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  syncOnlineEventNames?: boolean;

  @IsOptional()
  @IsString({ each: true })
  sponsorLogos?: string[];

  @IsOptional()
  @IsBoolean()
  teamScoringEnabled?: boolean;
}
