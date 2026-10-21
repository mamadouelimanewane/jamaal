-- Pièce d'identité modifiable sur la fiche consultant : photos recto/verso privées dans une table à part
-- (pour ne jamais alourdir les requêtes sur Consultant). Additif et rejouable.
CREATE TABLE IF NOT EXISTS "ConsultantPiece" (
  "consultantId" TEXT PRIMARY KEY,
  "front"        BYTEA,
  "back"         BYTEA,
  "mime"         TEXT,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$
BEGIN
  ALTER TABLE "ConsultantPiece" ADD CONSTRAINT "ConsultantPiece_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
