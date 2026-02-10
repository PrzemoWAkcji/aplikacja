-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "heat" INTEGER,
ADD COLUMN     "lane" INTEGER;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "startTime" TIMESTAMP(3);
