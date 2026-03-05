export class UpdateResultDto {
  place?: number;
  time?: string;
  wind?: number;
  status?: string;
  round1Result?: string;
  round1Wind?: number | null;
  round2Result?: string;
  round2Wind?: number | null;
  round3Result?: string;
  round3Wind?: number | null;
  round4Result?: string;
  round4Wind?: number | null;
  round5Result?: string;
  round5Wind?: number | null;
  round6Result?: string;
  round6Wind?: number | null;
  bestResult?: string;
  verticalJSON?: string;
  fieldJSON?: string;
}
