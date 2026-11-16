ALTER TABLE "ShopEvent" ADD COLUMN IF NOT EXISTS "source" TEXT;
CREATE INDEX IF NOT EXISTS "ShopEvent_consultant_source_createdAt_idx"
  ON "ShopEvent" ("consultantId", "source", "createdAt");
