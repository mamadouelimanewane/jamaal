-- Les statuts avant expédition suivent le paiement :
--   rien encaissé → NON_PAYEE ; acompte ou partiel → EN_ATTENTE ; payée en totalité → CONFIRMEE.
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NON_PAYEE';

CREATE TEMP TABLE _realign ON COMMIT DROP AS
SELECT id,
  CASE WHEN "paymentStatus" = 'PAYE' THEN 'CONFIRMEE'
       WHEN "depositPaidAt" IS NOT NULL OR "installmentsPaid" > 0 THEN 'EN_ATTENTE'
       ELSE 'NON_PAYEE' END::"OrderStatus" AS want
FROM "Order"
WHERE status IN ('EN_ATTENTE', 'CONFIRMEE');

WITH changed AS (
  UPDATE "Order" o SET status = r.want FROM _realign r
  WHERE o.id = r.id AND o.status <> r.want
  RETURNING o.id, o.status
)
INSERT INTO "OrderStatusHistory" (id, "orderId", status, "createdAt")
SELECT 'realign-' || md5(id || status::text), id, status, now() FROM changed;
