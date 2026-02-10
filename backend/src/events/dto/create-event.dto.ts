export class CreateEventDto {
    name: string;
    code: string;
    gender: string; // M, K, MIX
    meetingId: string;
    startTime?: string; // ISO Date string
}
