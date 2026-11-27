-- Wallet client (avoir) : registre WalletTransaction avec ownerType = 'CUSTOMER' ; le client l'utilise au panier
-- avec son code d'avoir personnel (envoyé sur WhatsApp à chaque crédit).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "avoirCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_avoirCode_key" ON "Customer"("avoirCode");
