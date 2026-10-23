-- Détection de fraude sur les commissions : signalements, commissions bloquées « EN_REVUE » avant versement.
-- Additif et rejouable.
CREATE TABLE IF NOT EXISTS "FraudFlag" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "consultantId" TEXT NOT NULL,
  "orderId" TEXT,
  "details" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'OUVERT',
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "FraudFlag_key_key" ON "FraudFlag"("key");
CREATE INDEX IF NOT EXISTS "FraudFlag_status_idx" ON "FraudFlag"("status");
CREATE INDEX IF NOT EXISTS "FraudFlag_consultant_idx" ON "FraudFlag"("consultantId");
