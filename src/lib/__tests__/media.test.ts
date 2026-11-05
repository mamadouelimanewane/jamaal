import { test } from "node:test";
import assert from "node:assert/strict";
import { isVideoUrl, isVideoFile, mediaPath, pathFitsScope, parseMediaList, videoFileError, videoContentType, isMediaScope } from "../media";
import { parsePhotoList } from "../product-photos";

test("isVideoUrl reconnaît les vidéos par l'extension", () => {
  assert.equal(isVideoUrl("https://x.public.blob.vercel-storage.com/produits/1-a-AbC.mp4"), true);
  assert.equal(isVideoUrl("https://x/a.MOV?download=1"), true);
  assert.equal(isVideoUrl("https://x/a.webm#t=0.1"), true);
  assert.equal(isVideoUrl("https://x/a.jpg"), false);
  assert.equal(isVideoUrl(null), false);
});

test("fichiers vidéo de la galerie : type ou extension, contrôle de taille", () => {
  assert.equal(isVideoFile({ type: "", name: "IMG_0001.MOV" }), true);
  assert.equal(isVideoFile({ type: "image/jpeg", name: "a.jpg" }), false);
  assert.equal(videoContentType({ type: "", name: "a.mov" }), "video/quicktime");
  assert.equal(videoContentType({ type: "", name: "a" }), "video/mp4");
  assert.equal(videoFileError({ type: "video/mp4", name: "a.mp4", size: 5e6 }), null);
  assert.match(videoFileError({ type: "video/mp4", name: "a.mp4", size: 200 * 1024 * 1024 }) ?? "", /100 Mo/);
  assert.match(videoFileError({ type: "video/x-msvideo", name: "a.avi", size: 10 }) ?? "", /Format/);
});

test("chemins rangés dans le dossier de l'espace", () => {
  const p = mediaPath("boutique", "Ma vidéo été.MP4", 123);
  assert.equal(p, "boutiques/123-Ma-video-ete.mp4");
  assert.equal(pathFitsScope(p, "boutique"), true);
  assert.equal(pathFitsScope(p, "produit"), false);
  assert.equal(pathFitsScope("boutiques/../produits/x.mp4", "boutique"), false);
  assert.equal(isMediaScope("kit"), true);
  assert.equal(isMediaScope("toString"), false);
});

test("liste de photos et vidéos d'un formulaire", () => {
  assert.deepEqual(parseMediaList(JSON.stringify(["https://a/b.mp4", "https://a/b.mp4", " /x/y.jpg "]), 5), ["https://a/b.mp4", "/x/y.jpg"]);
  assert.throws(() => parseMediaList(JSON.stringify(["javascript:alert(1)"]), 5));
  assert.throws(() => parseMediaList(JSON.stringify(["https://a/1.jpg", "https://a/2.jpg"]), 1));
  assert.deepEqual(parseMediaList(null, 3), []);
});

test("fiche produit : la photo principale n'est jamais une vidéo", () => {
  assert.deepEqual(parsePhotoList(JSON.stringify(["https://a/v.mp4", "https://a/p.jpg", "https://a/q.jpg"])), { photo: "https://a/p.jpg", gallery: ["https://a/v.mp4", "https://a/q.jpg"] });
  assert.throws(() => parsePhotoList(JSON.stringify(["https://a/v.mp4"])), /au moins une photo/);
  assert.deepEqual(parsePhotoList("[]"), { photo: null, gallery: [] });
});
