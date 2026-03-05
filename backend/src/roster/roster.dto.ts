export class RosterEntryDto {
  // Identifiers
  meetingId?: string;
  entryId?: string;
  startListId?: string;

  // Event details
  eventStart?: string;
  eventCode?: string;
  eventName?: string;
  pzlaEventCode?: string;
  pzlaEventCodeNum?: number;
  ukaEventCode?: string;
  eventStage?: string;
  ageGroup?: string;
  heat?: number;
  multipleAgeGroups?: string;
  oldestAgeGroup?: string;
  combinedEventRelation?: string;

  // Athlete information
  title?: string;
  relayTeamName?: string;
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: string;

  // Para classifications
  paraClassRunJump?: string;
  paraClassThrow?: string;

  // Notes
  notesPublic?: string;
  notesInternal?: string;

  // Personal info
  countryCode?: string;
  dateOfBirth?: string;
  yearOfBirth?: number;
  schoolGrade?: string;
  tilastopajaId?: string;
  relayId?: string;

  // Club/Team
  shortClubName?: string;
  clubName?: string;
  teamName?: string;
  teamGender?: string;

  // Race assignment
  bibNumber?: string;
  lane?: number;
  eventGroup?: string;

  // Performance
  personalBest?: string;
  seasonBest?: string;
  seedingResult?: string;
}

export class RosterResultDto extends RosterEntryDto {
  // Results
  place?: number;
  placeGender?: number;
  result?: string;
  resultRounded?: string;
  windReading?: string;

  // Field event trials (up to 6 rounds)
  round1Result?: string;
  round2Result?: string;
  round3Result?: string;
  round4Result?: string;
  round5Result?: string;
  round6Result?: string;

  // Additional round metadata
  round1Wind?: string;
  round2Wind?: string;
  round3Wind?: string;
  round4Wind?: string;
  round5Wind?: string;
  round6Wind?: string;
}

export class ImportRosterCsvDto {
  meetingId: string;
  csvContent: string;
}

export class ExportRosterCsvDto {
  meetingId: string;
  includeResults?: boolean;
}
