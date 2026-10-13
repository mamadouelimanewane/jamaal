import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMetaPayload } from "../whatsapp/meta";
import { parseReplyMarkers, waOrderLink } from "../whatsapp/format";
import { parseLivreurCommand } from "../whatsapp/livreur-commands";
import { orderMessage } from "../whatsapp/order-notify";
import { buildCatalogCsv, catalogItemId, parseCatalogItemId } from "../whatsapp/catalog";
import { parseAudience, personalize } from "../whatsapp/campaigns";
import { fallbackStatusText } from "../automation/morning-kit";
import { envAdminTails } from "../ai/whatsapp-staff";
import { orderWhatsAppText } from "../../components/OrderOnWhatsApp";

test("Meta : modèle hors 24 h (lien dans {{1}}), sinon image, boutons, bouton lien ou texte", () => {
  const tpl = buildMetaPayload("221770000000", "Bonjour\nCommande reçue", { cta: { label: "Payer", url: "https://x.sn/commande/1" } }, "jamaal_message", "fr");
  assert.equal(tpl.type, "template");
  assert.match(JSON.stringify(tpl), /Bonjour Commande reçue Payer : https:\/\/x.sn\/commande\/1/);
  const btn = buildMetaPayload("221", "Livraison ?", { free: true, buttons: ["Livraison à domicile !!", "Retrait", "Autre", "Trop"] }, "jamaal_message") as { type: string; interactive: { action: { buttons: { reply: { title: string } }[] } } };
  assert.equal(btn.type, "interactive");
  assert.equal(btn.interactive.action.buttons.length, 3);
  assert.ok(btn.interactive.action.buttons[0].reply.title.length <= 20);
  const cta = buildMetaPayload("221", "Votre commande", { free: true, cta: { label: "Payer ma commande", url: "https://x.sn/c" } }, "") as { interactive: { type: string } };
  assert.equal(cta.interactive.type, "cta_url");
  assert.equal(buildMetaPayload("221", "Visuel", { free: true, imageUrl: "https://x.sn/v.png" }, "").type, "image");
  assert.equal(buildMetaPayload("221", "Salut", { free: true }, "tpl").type, "text");
});

test("Marqueurs de l'assistant : boutons et lien retirés du texte, lien prioritaire, chemins complétés", () => {
  const a = parseReplyMarkers("Je valide la commande ?\n[[boutons: Oui, je valide | Modifier]]", "https://j.sn");
  assert.deepEqual(a, { text: "Je valide la commande ?", buttons: ["Oui, je valide", "Modifier"] });
  const b = parseReplyMarkers("Commande créée ✅ [[lien: Payer ma commande | /commande/abc]] [[boutons: Merci]]", "https://j.sn");
  assert.deepEqual(b, { text: "Commande créée ✅", cta: { label: "Payer ma commande", url: "https://j.sn/commande/abc" } });
  // lien non https refusé
  assert.equal(parseReplyMarkers("x [[lien: Voir | http://pirate]]", "https://j.sn").cta, undefined);
  assert.equal(parseReplyMarkers("Bonjour", "https://j.sn").text, "Bonjour");
  assert.equal(waOrderLink("+221 77 752 92 88", "Je veux Aqua"), "https://wa.me/221777529288?text=Je%20veux%20Aqua");
});

test("Livreur : commandes courtes reconnues (accents, majuscules)", () => {
  assert.deepEqual(parseLivreurCommand("Mes livraisons"), { kind: "list" });
  assert.deepEqual(parseLivreurCommand("Récupéré 2RQ1YXQF"), { kind: "step", to: "RECUPEREE", ref: "2rq1yxqf" });
  assert.deepEqual(parseLivreurCommand("en route 2rq1yxqf"), { kind: "step", to: "EN_ROUTE", ref: "2rq1yxqf" });
  assert.deepEqual(parseLivreurCommand("Livré 4821"), { kind: "step", to: "LIVREE", code: "4821" });
  const fail = parseLivreurCommand("Échec 2RQ1YXQF client absent");
  assert.equal(fail.kind === "step" && fail.to, "ECHEC");
  assert.equal(fail.kind === "step" && fail.note, "client absent");
  assert.deepEqual(parseLivreurCommand("bonjour"), { kind: "help" });
});

test("Suivi de commande : bouton Payer à la création (sauf commande prise sur WhatsApp), pas de doublon livraison JAMAAL", () => {
  const o = { id: "cmabcdef2rq1yxqf", customerName: "Awa Diop", total: 16300, paymentStatus: "EN_ATTENTE", channel: "SITE", deliveryMode: "RETRAIT_CONSULTANT" };
  const created = orderMessage("CREEE", o, "https://j.sn");
  assert.match(created!.text, /Bonjour Awa, merci pour votre commande JAMAAL n° 2RQ1YXQF \(16\s300 FCFA\)/);
  assert.deepEqual(created!.cta, { label: "Payer ma commande", url: "https://j.sn/commande/cmabcdef2rq1yxqf" });
  assert.equal(orderMessage("CREEE", { ...o, channel: "WHATSAPP" }, "https://j.sn"), null);
  assert.equal(orderMessage("CREEE", { ...o, paymentStatus: "PAYE" }, "https://j.sn")!.cta!.label, "Suivre ma commande");
  assert.equal(orderMessage("LIVREE", { ...o, deliveryMode: "LIVRAISON_JAMAAL" }, "https://j.sn"), null);
  assert.ok(orderMessage("LIVREE", o, "https://j.sn"));
  assert.equal(orderMessage("ANNULEE", o, "https://j.sn")!.cta, undefined);
});

test("Catalogue WhatsApp : une ligne par format, identifiants réversibles, CSV échappé", () => {
  assert.equal(catalogItemId("p1", 2), "p1-v2");
  assert.deepEqual(parseCatalogItemId("p1-v2"), { productId: "p1", volumeIndex: 2 });
  assert.deepEqual(parseCatalogItemId("cmxyz"), { productId: "cmxyz", volumeIndex: null });
  const csv = buildCatalogCsv(
    [
      { id: "p1", name: "Aqua, Soul", slug: "aqua-soul", shortDescription: "Frais \"marin\"", photo: "/img/a.jpg", stock: 3, regularPrice: 16300, volumes: [{ label: "70 ml", price: 16300 }, { label: "15 ml", price: 6500 }] },
      { id: "p2", name: "Sans photo", slug: "x", shortDescription: "", photo: null, stock: 1, regularPrice: 1000, volumes: [] },
      { id: "p3", name: "Gel", slug: "gel", shortDescription: "Doux", photo: "https://cdn/x.png", stock: 0, regularPrice: 5000, volumes: [] },
    ],
    "https://j.sn"
  ).trim().split("\n");
  assert.equal(lines(csv), 4);
  assert.equal(csv[0], "id,title,description,availability,condition,price,link,image_link,brand");
  assert.equal(csv[1], `p1-v0,"Aqua, Soul 70 ml","Frais ""marin""",in stock,new,16300 XOF,https://j.sn/produits/aqua-soul,https://j.sn/img/a.jpg,JAMAAL · Chogan`);
  assert.match(csv[3], /^p3,Gel,Doux,available for order,new,5000 XOF,/);
});
const lines = (a: string[]) => a.length;

test("Campagnes : audience bornée, bouton https seulement, prénom personnalisé", () => {
  assert.deepEqual(parseAudience({ target: "REVENDEURS", inactiveDays: "99999", cta: { label: "Voir", url: "javascript:alert(1)" } }), { target: "REVENDEURS", inactiveDays: 3650, category: undefined, consultantId: undefined, cta: null });
  assert.equal(parseAudience({ cta: { label: "", url: "https://j.sn/offres" } }).cta?.label, "Voir");
  assert.equal(personalize("Bonjour {prenom} ! Merci {nom}.", "Awa Diop"), "Bonjour Awa ! Merci Awa Diop.");
});

test("Kit du matin, admins déclarés, bouton « Commander sur WhatsApp »", () => {
  const t = fallbackStatusText({ name: "Aqua Soul", slug: "aqua", price: 16300, inspiredBy: "Acqua di Gio", inspiredBrand: "Armani", family: "Aquatique" });
  assert.match(t, /inspiré de Acqua di Gio \(Armani\)/);
  assert.match(t, /16\s300 FCFA/);
  assert.deepEqual(envAdminTails("+221 77 752 92 88, 776700996;bad"), ["777529288", "776700996"]);
  assert.equal(orderWhatsAppText(["Aqua Soul — 16 300 FCFA"], "moussa-diop"), "Bonjour JAMAAL, je souhaite commander :\n• Aqua Soul — 16 300 FCFA\nRevendeur : moussa-diop");
  assert.equal(orderWhatsAppText(["X"], ""), "Bonjour JAMAAL, je souhaite commander :\n• X");
});
