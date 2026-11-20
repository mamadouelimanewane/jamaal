ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "consultantId" TEXT;
ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "source" TEXT;
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_consultantId_createdAt_idx" ON "AnalyticsEvent"("consultantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_source_createdAt_idx" ON "AnalyticsEvent"("source", "createdAt");
