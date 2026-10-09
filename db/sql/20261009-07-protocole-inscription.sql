-- Inscription : pièce d'identité, protocole de partenariat signé, titulaire du wallet. Rejouable.
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "idType" TEXT;
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "idFront" BYTEA;
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "idBack" BYTEA;
ALTER TABLE "ConsultantApplication" ADD COLUMN IF NOT EXISTS "idMime" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "walletHolderName" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "idType" TEXT;
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
CREATE TABLE IF NOT EXISTS "ProtocolSignature" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "textHash" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "signerName" TEXT NOT NULL,
  "idType" TEXT,
  "idNumber" TEXT,
  "address" TEXT,
  "phone" TEXT,
  "image" BYTEA NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applicationId" TEXT,
  "consultantId" TEXT,
  CONSTRAINT "ProtocolSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProtocolSignature_applicationId_key" ON "ProtocolSignature"("applicationId");
CREATE INDEX IF NOT EXISTS "ProtocolSignature_consultantId_idx" ON "ProtocolSignature"("consultantId");
DO $$ BEGIN
  ALTER TABLE "ProtocolSignature" ADD CONSTRAINT "ProtocolSignature_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ConsultantApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
