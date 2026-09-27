-- AlterTable
ALTER TABLE "Consultant" ADD COLUMN     "sponsorId" TEXT;

-- CreateIndex
CREATE INDEX "Consultant_sponsorId_idx" ON "Consultant"("sponsorId");

-- AddForeignKey
ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Consultant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

