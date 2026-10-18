-- Gestion des utilisateurs : statut du compte, dernière connexion, profils de privilèges (rôles d'équipe).
-- Additif et rejouable. Un compte existant reste actif et sans profil (= accès complet pour un administrateur).

CREATE TABLE IF NOT EXISTS "AccessProfile" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  -- { "module": "read" | "write", ... } ; voir src/lib/permissions.ts
  "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessProfile_name_key" ON "AccessProfile" ("name");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileId"   TEXT;
CREATE INDEX IF NOT EXISTS "User_profileId_idx" ON "User" ("profileId");

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AccessProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
