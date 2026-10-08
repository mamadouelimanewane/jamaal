-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "choganCode" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_choganCode_idx" ON "Product"("choganCode");
