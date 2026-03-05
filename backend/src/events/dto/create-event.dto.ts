export class CreateEventDto {
  name: string;
  code: string;
  gender: string; // M, K, MIX
  meetingId: string;
  startTime?: string; // ISO Date string
  completedTime?: string; // HH:mm
  eventCode?: string; // Roster Athletics event code
  ageGroup?: string; // U16, U18, U20, Senior, etc.
  stage?: string; // Final, Heat, Semi-Final, Qualification
  model?: string; // Standard, Technical 3+3, etc.
  trialsMode?: string; // "3", "4", "6", "6_ALL"
  requiresWind?: boolean;
  heights?: string; // JSON string array for vertical jumps
  lanes?: number;
  finalStartTime?: string;
  finalCount?: number;
  finalInterval?: number;
  finalStartTimes?: string;
  advancementRule?: string;
}
