/*
  Warnings:

  - You are about to drop the column `bib` on the `Entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "bib",
ADD COLUMN     "pb" TEXT,
ADD COLUMN     "sb" TEXT;
