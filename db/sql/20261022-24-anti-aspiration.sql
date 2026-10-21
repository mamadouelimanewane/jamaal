-- Robot anti-aspiration : visiteurs bannis (lien piège suivi, limites dépassées). Additif et rejouable.
CREATE TABLE IF NOT EXISTS "BotBan" (
  "key"       TEXT PRIMARY KEY,
  "ip"        TEXT NOT NULL,
  "userAgent" TEXT,
  "reason"    TEXT NOT NULL,
  "path"      TEXT,
  "hits"      INTEGER NOT NULL DEFAULT 1,
  "until"     TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BotBan_until_idx" ON "BotBan" ("until");

-- Requêtes refusées par jour et par motif (tableau de bord de la protection).
CREATE TABLE IF NOT EXISTS "BotBlockStat" (
  "day"    TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "count"  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "reason")
);
