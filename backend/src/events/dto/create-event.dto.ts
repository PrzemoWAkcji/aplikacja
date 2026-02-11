export class CreateEventDto {
    name: string;
    code: string;
    gender: string; // M, K, MIX
    meetingId: string;
    startTime?: string; // ISO Date string
    eventCode?: string; // Roster Athletics event code
    ageGroup?: string; // U16, U18, U20, Senior, etc.
    stage?: string; // Final, Heat, Semi-Final, Qualification
    heights?: string; // JSON string array for vertical jumps
}
