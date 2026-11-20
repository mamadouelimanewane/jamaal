-- Passerelle Option A (KwingoChat <-> JAMAAL) :
-- 1. Rattachement consultant sur la fiche client (Customer.consultantId) pour le routage dynamique.
-- 2. Assignation consultant et attributs de contact (customAttributes) sur WhatsAppThread (null = unassigned).
-- Additif et rejouable (IF NOT EXISTS).

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "consultantId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_consultantId_idx" ON "Customer"("consultantId");

ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "consultantId" TEXT;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "assignedSource" TEXT;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "customAttributes" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "WhatsAppThread" ADD COLUMN IF NOT EXISTS "kwingoContactId" TEXT;
CREATE INDEX IF NOT EXISTS "WhatsAppThread_consultantId_idx" ON "WhatsAppThread"("consultantId");

-- Rétro-remplissage : rattache chaque fiche client sans consultant au consultant actif de sa dernière commande non annulée.
UPDATE "Customer" c
SET "consultantId" = sub."consultantId"
FROM (
  SELECT DISTINCT ON (o."customerId") o."customerId", o."consultantId"
  FROM "Order" o
  JOIN "Consultant" cons ON cons.id = o."consultantId" AND cons.active = true
  WHERE o."customerId" IS NOT NULL
    AND o."consultantId" IS NOT NULL
    AND o.status <> 'ANNULEE'
  ORDER BY o."customerId", o."createdAt" DESC
) sub
WHERE c.id = sub."customerId"
  AND c."consultantId" IS NULL;

-- Rétro-remplissage des conversations WhatsApp existantes dont le client a un consultant actif connu (les autres restent dans unassigned = NULL).
UPDATE "WhatsAppThread" t
SET
  "consultantId" = matched.id,
  "assignedAt" = COALESCE(t."assignedAt", CURRENT_TIMESTAMP),
  "assignedSource" = COALESCE(t."assignedSource", 'ROUTAGE_CLIENT'),
  "customAttributes" = COALESCE(t."customAttributes", '{}'::jsonb) || jsonb_build_object(
    'assigned_to', matched.id,
    'consultant_id', matched.id,
    'consultant_name', matched.name,
    'consultant_email', matched.email,
    'consultant_phone', matched.whatsapp,
    'routing_source', 'ROUTAGE_CLIENT'
  )
FROM (
  SELECT DISTINCT ON (t2.phone)
    t2.phone,
    cons.id,
    cons.name,
    cons.email,
    cons.whatsapp
  FROM "WhatsAppThread" t2
  JOIN "Order" o
    ON right(regexp_replace(coalesce(o."customerPhone", ''), '[^0-9]', '', 'g'), 9) = right(regexp_replace(t2.phone, '[^0-9]', '', 'g'), 9)
   AND length(right(regexp_replace(t2.phone, '[^0-9]', '', 'g'), 9)) = 9
   AND o.status <> 'ANNULEE'
   AND o."consultantId" IS NOT NULL
  JOIN "Consultant" cons ON cons.id = o."consultantId" AND cons.active = true
  WHERE t2."consultantId" IS NULL
  ORDER BY t2.phone, o."createdAt" DESC
) matched
WHERE t.phone = matched.phone
  AND t."consultantId" IS NULL;
