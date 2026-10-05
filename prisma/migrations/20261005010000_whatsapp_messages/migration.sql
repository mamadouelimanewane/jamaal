CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
CREATE INDEX "WhatsAppMessage_providerId_idx" ON "WhatsAppMessage"("providerId");
