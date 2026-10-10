-- Comptabilité et finance : dépenses détaillées, écritures manuelles, budgets, clôtures,
-- comptages de caisse, remboursements de commandes annulées. Rejouable.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vatAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "account" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'CAISSE';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "receipt" BYTEA;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "receiptMime" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "receiptName" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");

-- Dépenses existantes : compte de charge déduit de la catégorie, payées à leur date.
UPDATE "Expense" SET "account" = CASE "category"
    WHEN 'Achat stock' THEN '601'
    WHEN 'Livraison' THEN '612'
    WHEN 'Marketing' THEN '627'
    WHEN 'Salaires' THEN '661'
    WHEN 'Loyer' THEN '622'
    ELSE '638' END
  WHERE "account" IS NULL;
UPDATE "Expense" SET "paidAt" = "date" WHERE "paid" = true AND "paidAt" IS NULL;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundChannel" TEXT;

CREATE TABLE IF NOT EXISTS "JournalEntry" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "journal" TEXT NOT NULL DEFAULT 'OD',
  "label" TEXT NOT NULL,
  "reference" TEXT,
  "lines" JSONB NOT NULL,
  "template" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JournalEntry_date_idx" ON "JournalEntry"("date");

CREATE TABLE IF NOT EXISTS "Budget" (
  "id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_month_account_key" ON "Budget"("month", "account");

CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
  "month" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedBy" TEXT,
  "snapshot" JSONB NOT NULL,
  "note" TEXT,
  CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("month")
);

CREATE TABLE IF NOT EXISTS "CashCount" (
  "id" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "counted" INTEGER NOT NULL,
  "theoretical" INTEGER NOT NULL,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CashCount_account_date_idx" ON "CashCount"("account", "date");
