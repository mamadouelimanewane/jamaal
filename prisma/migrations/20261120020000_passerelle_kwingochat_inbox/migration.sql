-- AlterTable
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "consultantId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_consultantId_idx" ON "Customer"("consultantId");

-- AlterTable
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "consultantId" TEXT;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "assignedSource" TEXT;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "customAttributes" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "kwingoContactId" TEXT;
CREATE INDEX IF NOT EXISTS "WhatsAppThread_consultantId_idx" ON "WhatsAppThread"("consultantId");
