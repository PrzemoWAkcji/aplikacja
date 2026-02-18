export class GenerateStartListDto {
    lanes?: number;
    heats?: number;
    method: 'SNAKE' | 'ZIGZAG' | 'BEST_FROM_LAST' | 'BEST_FROM_FIRST' | 'RANDOM';
    criterion: 'PB' | 'SB';
    laneAssignment?: 'STANDARD' | 'RANDOM' | 'INSIDE_OUT';
}
