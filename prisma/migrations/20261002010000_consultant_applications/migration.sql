CREATE TYPE "ApplicationStatus" AS ENUM ('NOUVELLE', 'ACCEPTEE', 'REFUSEE');

CREATE TABLE "ConsultantApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Sénégal',
    "experience" TEXT,
    "motivation" TEXT,
    "sponsorCode" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NOUVELLE',
    "adminNote" TEXT,
    "consultantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "ConsultantApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConsultantApplication_status_createdAt_idx" ON "ConsultantApplication"("status", "createdAt");
CREATE INDEX "ConsultantApplication_email_idx" ON "ConsultantApplication"("email");
