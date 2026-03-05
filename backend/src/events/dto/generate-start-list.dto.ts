export class GenerateStartListDto {
  lanes?: number;
  heats?: number;
  method:
    | 'SNAKE'
    | 'ZIGZAG'
    | 'BEST_FROM_LAST'
    | 'BEST_FROM_FIRST'
    | 'RANDOM'
    | 'ALPHABETIC'
    | 'ALPHANUMERIC'
    | 'INDOOR_TIME'
    | 'RESULT_VALUE';
  criterion: 'PB' | 'SB' | 'RESULT';
  laneAssignment?:
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
}
