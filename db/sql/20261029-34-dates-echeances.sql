-- Paiement en plusieurs fois : date de chaque échéance payée (comptabilité : encaissement à sa date).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "installmentPaidDates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];
