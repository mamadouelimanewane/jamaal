-- Codes promo générés par le système et ciblés : tous les clients, un client, un vendeur, tous les vendeurs.
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'TOUS_CLIENTS';
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "targetName" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "targetPhone" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "targetConsultantId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "note" TEXT;
