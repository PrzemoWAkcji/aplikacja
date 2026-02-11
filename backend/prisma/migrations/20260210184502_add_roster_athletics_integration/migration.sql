-- AlterTable Event
ALTER TABLE "Event" ADD COLUMN "eventCode" TEXT;
ALTER TABLE "Event" ADD COLUMN "ageGroup" TEXT;
ALTER TABLE "Event" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'Final';
ALTER TABLE "Event" ADD COLUMN "heights" TEXT;

-- AlterTable Entry
ALTER TABLE "Entry" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Entry" ADD COLUMN "middleName" TEXT;
ALTER TABLE "Entry" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Entry" ADD COLUMN "countryCode" TEXT DEFAULT 'POL';
ALTER TABLE "Entry" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Entry" ADD COLUMN "yearOfBirth" INTEGER;
ALTER TABLE "Entry" ADD COLUMN "gender" TEXT;
ALTER TABLE "Entry" ADD COLUMN "tilastopajaId" TEXT;
ALTER TABLE "Entry" ADD COLUMN "entryId" TEXT;
ALTER TABLE "Entry" ADD COLUMN "startListId" TEXT;
ALTER TABLE "Entry" ADD COLUMN "seedingResult" TEXT;

-- AlterTable Result
ALTER TABLE "Result" ADD COLUMN "placeGender" INTEGER;
ALTER TABLE "Result" ADD COLUMN "resultRounded" TEXT;
ALTER TABLE "Result" ADD COLUMN "windReading" TEXT;
ALTER TABLE "Result" ADD COLUMN "round1Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "round2Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "round3Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "round4Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "round5Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "round6Result" TEXT;
ALTER TABLE "Result" ADD COLUMN "bestResult" TEXT;
