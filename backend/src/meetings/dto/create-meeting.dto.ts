export class CreateMeetingDto {
  name: string;
  date: string; // ISO Date string
  endDate?: string; // ISO Date string
  location: string;
  city?: string;
  country?: string;
  domtelMeetingCode?: string;
  season?: string;
  type?: string;
  status?: string;
  syncOnlineEventNames?: boolean;
}
