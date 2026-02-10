import { IsInt, IsOptional, Min } from 'class-validator';

export class GenerateStartListDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    heatsCount?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    lanesPerHeat?: number;
}
