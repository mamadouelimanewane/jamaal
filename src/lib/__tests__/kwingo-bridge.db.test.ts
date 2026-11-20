/**
 * Tests de la passerelle Option A (KwingoChat <-> JAMAAL) :
 * 1. Fonctions pures (extraction slug boutique /c/<slug> et ?ref=<slug>, construction custom_attributes).
 * 2. Sur la base de test Neon (DB_TEST=1) :
 *    - Assignation automatique des retours par consultant via les attributs de contact lors de l'envoi d'une campagne.
 *    - Routage dynamique vers le bon consultant sur un message spontané d'un client ayant commandé chez un consultant.
 *    - Routage dynamique via lien de boutique /c/<slug> dans un message spontané.
 *    - Client sans consultant : reste dans « unassigned » (consultantId = null, custom_attributes.assigned_to = null).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  assignCampaignRecipientAttributes,
  assignThreadToConsultant,
  buildContactCustomAttributes,
  extractConsultantSlugFromText,
  routeInboundClientMessage,
} from "../whatsapp/kwingo-bridge";

const enabled = process.env.DB_TEST === "1";
const T = `kb${Date.now().toString(36)}`;
const CONS_A_ID = `${T}-cons-a`;
const CONS_B_ID = `${T}-cons-b`;
const CUST_WITH_CONS_PHONE = "221779990001";
const CUST_CAMPAIGN_PHONE = "221779990002";
const CUST_SPONTANEOUS_SLUG_PHONE = "221779990003";
const CUST_UNASSIGNED_PHONE = "221779990004";

test("extractConsultantSlugFromText : détecte /c/<slug> et ?ref=<slug>", () => {
  assert.equal(extractConsultantSlugFromText("Bonjour j'ai vu https://www.jamaal.sn/c/awa-diop merci"), "awa-diop");
  assert.equal(extractConsultantSlugFromText("Lien produit https://www.jamaal.sn/produits/001m?ref=Fatou-Fall&utm=wa"), "fatou-fall");
  assert.equal(extractConsultantSlugFromText("Bonjour je voudrais commander un parfum"), null);
});

test("buildContactCustomAttributes : renseigne assigned_to ou laisse null (unassigned)", () => {
  const assigned = buildContactCustomAttributes(
    {
      id: "cons-1",
      name: "Awa Diop",
      email: "awa@jamaal.sn",
      whatsapp: "221770001122",
      slug: "awa-diop",
      city: "Dakar",
      source: "CAMPAGNE",
    },
    { campaignId: "camp-1", campaignTitle: "Relance Tabaski" },
  );
  assert.equal(assigned.assigned_to, "cons-1");
  assert.equal(assigned.consultant_id, "cons-1");
  assert.equal(assigned.consultant_name, "Awa Diop");
  assert.equal(assigned.routing_source, "CAMPAGNE");
  assert.equal(assigned.campaign_id, "camp-1");

  const unassigned = buildContactCustomAttributes(null);
  assert.equal(unassigned.assigned_to, null);
  assert.equal(unassigned.consultant_id, null);
  assert.equal(unassigned.routing_source, "UNASSIGNED");
});

let prismaRef: typeof import("../prisma").prisma;

before(async () => {
  if (!enabled) return;
  prismaRef = (await import("../prisma")).prisma;

  await prismaRef.consultant.createMany({
    data: [
      {
        id: CONS_A_ID,
        name: "Awa Diop Test",
        city: "Dakar",
        whatsapp: "221771110001",
        email: `${CONS_A_ID}@jamaal.sn`,
        slug: `${T}-awa`,
        active: true,
      },
      {
        id: CONS_B_ID,
        name: "Moussa Ndiaye Test",
        city: "Thiès",
        whatsapp: "221771110002",
        email: `${CONS_B_ID}@jamaal.sn`,
        slug: `${T}-moussa`,
        active: true,
      },
    ],
  });

  // Client ayant passé une commande avec le consultant A
  await prismaRef.order.create({
    data: {
      id: `${T}-order-1`,
      customerName: "Client Fidèle Awa",
      customerPhone: "+221 77 999 00 01",
      total: 28700,
      status: "LIVREE",
      consultantId: CONS_A_ID,
    },
  });
});

after(async () => {
  if (!enabled) return;
  await prismaRef.whatsAppThread.deleteMany({
    where: {
      phone: {
        in: [
          CUST_WITH_CONS_PHONE,
          CUST_CAMPAIGN_PHONE,
          CUST_SPONTANEOUS_SLUG_PHONE,
          CUST_UNASSIGNED_PHONE,
        ],
      },
    },
  });
  await prismaRef.order.deleteMany({ where: { id: `${T}-order-1` } });
  await prismaRef.consultant.deleteMany({ where: { id: { in: [CONS_A_ID, CONS_B_ID] } } });
  await prismaRef.$disconnect();
});

const dbOpts = { skip: !enabled && "DB_TEST non défini" };

test("campagne : pose les attributs de contact et route automatiquement le retour du client vers le consultant", dbOpts, async () => {
  // 1. Envoi de la campagne ciblée pour le consultant B
  const campAssign = await assignCampaignRecipientAttributes({
    phone: CUST_CAMPAIGN_PHONE,
    name: "Fatou Campagne",
    consultantId: CONS_B_ID,
    campaignId: `${T}-camp`,
    campaignTitle: "Offre Korité",
  });

  assert.equal(campAssign.consultant?.id, CONS_B_ID);
  assert.equal(campAssign.customAttributes.assigned_to, CONS_B_ID);
  assert.equal(campAssign.customAttributes.routing_source, "CAMPAGNE");

  // 2. Le client répond à la campagne -> son retour reste assigné à Moussa (CONS_B_ID) via les attributs de contact
  const inbound = await routeInboundClientMessage({
    phone: CUST_CAMPAIGN_PHONE,
    profileName: "Fatou Campagne",
    text: "Bonjour, je suis intéressée par l'offre !",
  });

  assert.equal(inbound.consultant?.id, CONS_B_ID);
  assert.equal(inbound.routing, "CAMPAGNE");
  assert.equal(inbound.customAttributes.assigned_to, CONS_B_ID);
  assert.equal(inbound.customAttributes.campaign_title, "Offre Korité");
});

test("message spontané : routage dynamique vers le consultant de la dernière commande du client", dbOpts, async () => {
  const res = await routeInboundClientMessage({
    phone: CUST_WITH_CONS_PHONE,
    profileName: "Client Fidèle Awa",
    text: "Bonjour, je voudrais recommander mon parfum",
  });

  assert.equal(res.consultant?.id, CONS_A_ID);
  assert.equal(res.routing, "ROUTAGE_CLIENT");
  assert.equal(res.customAttributes.assigned_to, CONS_A_ID);
  assert.equal(res.customAttributes.consultant_name, "Awa Diop Test");
});

test("message spontané avec lien boutique /c/<slug> : routage dynamique vers le consultant de la boutique", dbOpts, async () => {
  const res = await routeInboundClientMessage({
    phone: CUST_SPONTANEOUS_SLUG_PHONE,
    profileName: "Nouveau Visiteur Boutique",
    text: `Bonjour je viens de la boutique https://www.jamaal.sn/c/${T}-moussa`,
  });

  assert.equal(res.consultant?.id, CONS_B_ID);
  assert.equal(res.routing, "LIEN_BOUTIQUE");
  assert.equal(res.customAttributes.assigned_to, CONS_B_ID);
});

test("message spontané d'un client sans consultant : reste dans unassigned (assigned_to = null)", dbOpts, async () => {
  const res = await routeInboundClientMessage({
    phone: CUST_UNASSIGNED_PHONE,
    profileName: "Client Inconnu Sans Consultant",
    text: "Bonjour, quels sont vos parfums disponibles ?",
  });

  assert.equal(res.consultant, null);
  assert.equal(res.routing, "UNASSIGNED");
  assert.equal(res.customAttributes.assigned_to, null);
  assert.equal(res.customAttributes.consultant_id, null);

  const thread = await prismaRef.whatsAppThread.findUniqueOrThrow({
    where: { phone: CUST_UNASSIGNED_PHONE },
  });
  assert.equal(thread.consultantId, null);
  assert.equal(thread.assignedSource, null);

  // Le superviseur peut ensuite l'assigner manuellement puis le remettre dans unassigned
  const manual = await assignThreadToConsultant({
    phone: CUST_UNASSIGNED_PHONE,
    consultantId: CONS_A_ID,
    assignedByUserId: "admin-1",
  });
  assert.equal(manual.consultant?.id, CONS_A_ID);
  assert.equal(manual.customAttributes.assigned_to, CONS_A_ID);

  const backToUnassigned = await assignThreadToConsultant({
    phone: CUST_UNASSIGNED_PHONE,
    consultantId: null,
  });
  assert.equal(backToUnassigned.consultant, null);
  assert.equal(backToUnassigned.customAttributes.assigned_to, null);
});
