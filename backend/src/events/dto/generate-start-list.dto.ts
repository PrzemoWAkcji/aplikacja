import { IsEnum, IsInt, IsOptional, IsPositive, Min } from 'class-validator';

type SeMethod =
  | 'SNAKE'
  | 'ZIGZAG'
  | 'BEST_FROM_LAST'
  | 'BEST_FROM_FIRST'
  | 'RANDOM'
  | 'ALPHABETIC'
  | 'ALPHANUMERIC'
  | 'INDOOR_TIME'
  | 'RESULT_VALUE';

type LaneAssignment =
  | 'STANDARD'
  | 'RANDOM'
  | 'INSIDE_OUT'
  | 'ALPHABETIC'
  | 'ALPHANUMERIC'
  | 'BEST_TO_WORST'
  | 'WORST_TO_BEST'
  | 'WATERFALL'
  | 'WATERFALL_REVERSE'
  | 'WA_SPRINT_8'
  | 'INDOOR_400_4LANES';

export class GenerateStartListDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  lanes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  heats?: number;

  @IsEnum([
    'SNAKE',
    'ZIGZAG',
    'BEST_FROM_LAST',
    'BEST_FROM_FIRST',
    'RANDOM',
    'ALPHABETIC',
    'ALPHANUMERIC',
    'INDOOR_TIME',
    'RESULT_VALUE',
  ])
  method!: SeMethod;

  @IsEnum(['PB', 'SB', 'RESULT'])
  criterion!: 'PB' | 'SB' | 'RESULT';

  @IsOptional()
  @IsEnum([
    'STANDARD',
    'RANDOM',
    'INSIDE_OUT',
    'ALPHABETIC',
    'ALPHANUMERIC',
    'BEST_TO_WORST',
    'WORST_TO_BEST',
    'WATERFALL',
    'WATERFALL_REVERSE',
    'WA_SPRINT_8',
    'INDOOR_400_4LANES',
  ])
  laneAssignment?: LaneAssignment;
}
