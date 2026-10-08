/**
 * Temps réel, sur une vraie base (lancer avec SEARCH_DB_TEST=1 et DATABASE_URL d'une base de test) :
 * un produit créé, renommé puis supprimé apparaît / change / disparaît dans la recherche aussitôt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.SEARCH_DB_TEST === "1";

test("index en temps réel sur la base", { skip: !enabled && "SEARCH_DB_TEST non défini" }, async () => {
  const { prisma } = await import("../prisma");
  const { searchCatalog } = await import("../search-index");
  const id = `test-search-${Date.now()}`;
  const wait = () => new Promise((r) => setTimeout(r, 1100)); // intervalle de vérification de l'empreinte
  try {
    await searchCatalog("amorce"); // index déjà chargé, comme en production
    await prisma.product.create({
      data: { id, slug: id, name: "Zanzibar Nuit Test", category: "parfum-unisexe", shortDescription: "Produit de test", longDescription: [], choganCode: "ZZT999", inspiredBy: "Kilimandjaro", inspiredBrand: "Maison Test", regularPrice: 12345 },
    });
    await wait();
    let r = await searchCatalog("zanzibar");
    assert.equal(r.hits[0]?.doc.id, id, "produit créé trouvé");
    assert.equal((await searchCatalog("ZZT999")).hits[0]?.doc.id, id, "par code");
    assert.equal((await searchCatalog("kilimandjaro maison test")).hits[0]?.doc.id, id, "par inspiration");

    await prisma.product.update({ where: { id }, data: { name: "Tombouctou Aube Test" } });
    await wait();
    r = await searchCatalog("tombouctou");
    assert.equal(r.hits[0]?.doc.id, id, "nouveau nom trouvé");
    assert.equal((await searchCatalog("zanzibar")).hits.find((h) => h.doc.id === id), undefined, "ancien nom oublié");

    await prisma.product.delete({ where: { id } });
    await wait();
    assert.equal((await searchCatalog("tombouctou")).hits.find((h) => h.doc.id === id), undefined, "produit supprimé retiré");
  } finally {
    await prisma.product.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
