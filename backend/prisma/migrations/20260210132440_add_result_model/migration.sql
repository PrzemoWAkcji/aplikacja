-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "place" INTEGER,
    "time" TEXT,
    "wind" DOUBLE PRECISION,
    "reactionTime" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Result_entryId_key" ON "Result"("entryId");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
