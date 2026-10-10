import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const products = JSON.parse(readFileSync("import/pdf_products.json", "utf8"));
const existing = JSON.parse(readFileSync("src/data/chogan-catalog.json", "utf8"));

const getCategory = (code, name) => {
  if (code.startsWith("BSF")) return "gels-douche";
  if (code.startsWith("CRF")) return "cremes-corps";
  if (code.startsWith("COP")) return "parfum-ambiance";
  if (code.startsWith("LO")) return "lolum";
  if (code.startsWith("MM")) return "maquillage";
  if (code.startsWith("BH")) return "entretien-maison";
  if (code.startsWith("AR") || code.startsWith("BV") || code.startsWith("NM")) return "soins-corps";
  if (code.startsWith("CAP") || code.startsWith("SHM")) return "soins-cheveux";
  if (name.toLowerCase().includes("homme")) return "parfum-homme";
  if (name.toLowerCase().includes("femme")) return "parfum-femme";
  if (name.toLowerCase().includes("dentifrice")) return "soins-corps";
  return "autres-produits";
};

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s) => norm(s).replace(/\s+/g, "-").slice(0, 60).replace(/-$/, "");

async function run() {
  let count = 0;
  for (const p of products) {
    const slug = slugify(p.name) + "-" + p.code.toLowerCase();
    
    // Check if exists by code or slug
    const ext = existing.find(e => e.id === "chogan-"+p.code || (e.choganCode && e.choganCode === p.code));
    if (ext) continue; // Already in DB
    
    // Add to JSON and DB
    const newProd = {
      id: "chogan-" + p.code,
      slug,
      name: p.name,
      category: getCategory(p.code, p.name),
      shortDescription: p.name + " (" + p.format + "). Produit Chogan.",
      longDescription: [p.name + ". Format : " + p.format],
      regularPrice: p.price_fcfa,
      publicPrice: Math.round(p.price_fcfa / 1.25),
      reviewCount: 0,
      rating: 4.5,
      colorFrom: "#1d2f4f",
      colorTo: "#d9a99d",
      photo: null,
      isOfficial: true,
      choganCode: p.code
    };
    existing.push(newProd);
    count++;
    
    // Add to DB
    await prisma.product.upsert({
      where: { slug: newProd.slug },
      update: {},
      create: {
        id: newProd.id,
        slug: newProd.slug,
        name: newProd.name,
        category: newProd.category,
        choganCode: newProd.choganCode,
        shortDescription: newProd.shortDescription,
        longDescription: newProd.longDescription,
        regularPrice: newProd.regularPrice,
        publicPrice: newProd.publicPrice,
        colorFrom: newProd.colorFrom,
        colorTo: newProd.colorTo,
        stock: 0,
        lowStockThreshold: 5,
        isOfficial: true
      }
    });
  }
  
  writeFileSync("src/data/chogan-catalog.json", JSON.stringify(existing, null, 1) + "\n");
  console.log("Added " + count + " new products to JSON and Database!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
