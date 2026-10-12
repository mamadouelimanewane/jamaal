import { test } from "node:test";
import assert from "node:assert/strict";
import { driveDownloadUrl, driveFileId, isDriveFolderLink } from "../drive";
import { isAcceptablePhotoUrl, parsePhotoList } from "../product-photos";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

test("liens Google Drive reconnus (fichier partagé)", () => {
  assert.equal(driveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`), ID);
  assert.equal(driveFileId(`https://drive.google.com/file/d/${ID}/view?usp=drive_link`), ID);
  assert.equal(driveFileId(`https://drive.google.com/open?id=${ID}`), ID);
  assert.equal(driveFileId(`https://drive.google.com/uc?id=${ID}&export=download`), ID);
  assert.equal(driveFileId(`https://docs.google.com/uc?id=${ID}`), ID);
  assert.equal(driveFileId(`https://drive.usercontent.google.com/download?id=${ID}`), ID);
  assert.equal(driveFileId(`  https://drive.google.com/file/d/${ID}/view  `), ID);
  assert.equal(driveDownloadUrl(ID), `https://drive.google.com/uc?export=download&id=${ID}`);
});

test("liens refusés : dossier, autre site, http, identifiant trop court", () => {
  const folder = `https://drive.google.com/drive/folders/${ID}`;
  assert.equal(driveFileId(folder), null);
  assert.equal(isDriveFolderLink(folder), true);
  assert.equal(driveFileId(`https://evil.example/file/d/${ID}/view`), null);
  assert.equal(driveFileId(`http://drive.google.com/file/d/${ID}/view`), null);
  assert.equal(driveFileId("https://drive.google.com/file/d/abc/view"), null);
  assert.equal(driveFileId("pas un lien"), null);
});

test("liste de photos : principale + galerie, sans doublon, adresses sûres seulement", () => {
  assert.equal(parsePhotoList(null), null, "champ absent : photos inchangées");
  assert.deepEqual(parsePhotoList("[]"), { photo: null, gallery: [] });
  assert.deepEqual(parsePhotoList(JSON.stringify(["https://a.example/1.jpg", "/produits/2.jpg", "https://a.example/1.jpg"])), {
    photo: "https://a.example/1.jpg",
    gallery: ["/produits/2.jpg"],
  });
  assert.throws(() => parsePhotoList(JSON.stringify(["javascript:alert(1)"])), /refusée/);
  assert.throws(() => parsePhotoList(JSON.stringify(["http://a.example/x.jpg"])), /refusée/);
  assert.throws(() => parsePhotoList(JSON.stringify(Array.from({ length: 13 }, (_, i) => `https://a.example/${i}.jpg`))), /12 photos/);
  assert.throws(() => parsePhotoList("{oops"), /illisible/);
  assert.equal(isAcceptablePhotoUrl("//evil.example/x.jpg"), false);
  assert.equal(isAcceptablePhotoUrl("/produits/../../etc"), false);
  assert.equal(isAcceptablePhotoUrl("/produits/n42.jpg"), true);
});
