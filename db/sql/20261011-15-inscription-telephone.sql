-- Inscription par numéro de téléphone (revendeurs et clients) : l'e-mail devient optionnel,
-- un numéro de téléphone normalisé (chiffres uniquement, voir normalizePhone) peut servir
-- d'identifiant de connexion à sa place. Rejouable sans effet.

-- L'e-mail n'est plus obligatoire : au moins l'un des deux (e-mail ou téléphone) doit être renseigné.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_email_or_phone_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_email_or_phone_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
  END IF;
END $$;

-- Compte client (rôle CLIENT) rattaché à sa fiche client existante (historique de commandes).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_customerId_key" ON "User"("customerId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_customerId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';

-- Verrouillage anti-force-brute : la colonne suit maintenant l'identifiant utilisé (e-mail ou
-- téléphone), plus seulement l'e-mail.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LoginAttempt' AND column_name = 'email') THEN
    ALTER TABLE "LoginAttempt" RENAME COLUMN "email" TO "identifiant";
  END IF;
END $$;
