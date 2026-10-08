-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "inspiredBy" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "inspiredBrand" TEXT;
