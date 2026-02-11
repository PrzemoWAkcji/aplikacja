export class GenerateStartListDto {
    lanes?: number;
    method: 'SNAKE' | 'ZIGZAG' | 'BEST_FROM_LAST' | 'RANDOM';
    criterion: 'PB' | 'SB';
}
