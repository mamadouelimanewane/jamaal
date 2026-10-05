#!/usr/bin/env node
/**
 * Génère les icônes de l'application installable (PWA) à partir du logo :
 * recadrage sur le monogramme + nom, posé sur fond blanc crème.
 * Sortie : public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "public/logo/jamaal-logo.jpg";
// Zone utile du JPG (720×1080) : monogramme + « JAMAAL »
const crop = { left: 105, top: 225, width: 540, height: 605 };
mkdirSync("public/icons", { recursive: true });

async function icon(size, innerRatio, file) {
  const inner = Math.round(size * innerRatio);
  const logo = await sharp(SRC).extract(crop).resize({ height: inner, fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`public/icons/${file}`);
  console.log("→", file);
}

await icon(192, 0.86, "icon-192.png");
await icon(512, 0.86, "icon-512.png");
// « maskable » : marge de sécurité plus large (le système peut rogner en cercle)
await icon(512, 0.62, "icon-maskable-512.png");
await icon(180, 0.84, "apple-touch-icon.png");
