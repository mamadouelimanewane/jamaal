-- Rang attribué par l'admin (Leader, Parrain, Consultant). Rejouable.
ALTER TABLE "Consultant" ADD COLUMN IF NOT EXISTS "rank" TEXT;
