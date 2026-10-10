"use server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { requireAdmin } from "./auth-guard";
import { revalidatePath } from "next/cache";

const getCategory = (code: string, name: string) => {
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

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").trim();
const slugify = (s: string) => norm(s).slice(0, 60).replace(/-$/, "");

export async function importChoganExcelAction(formData: FormData) {
  try {
    await requireAdmin();
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "Aucun fichier fourni." };
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (file.name.endsWith('.txt') || file.name.endsWith('.json')) {
      const text = buffer.toString('utf8');
      let products = [];
      try { products = JSON.parse(text); } catch (e) { return { success: false, error: 'Fichier JSON/TXT invalide.' }; }
      
      let countNew = 0; let countUpdated = 0;
      for (const p of products) {
        if (!p.name) continue;
        const code = p.choganCode || (p.id ? p.id.replace('chogan-', '') : 'NO_CODE');
        const price_fcfa = p.regularPrice || p.publicPrice || p.price || 0;
        if (!price_fcfa) continue;
        const publicPrice = Math.round(price_fcfa / 1.25);
        const slug = slugify(p.name) + '-' + code.toLowerCase();
        const id = 'chogan-' + code;
        
        const existing = await prisma.product.findFirst({
          where: { OR: [{ choganCode: code }, { id: id }] }
        });
        
        if (existing) {
          if (existing.regularPrice !== price_fcfa) {
            await prisma.product.update({
              where: { id: existing.id },
              data: { regularPrice: price_fcfa, publicPrice: publicPrice }
            });
            countUpdated++;
          }
        } else {
          await prisma.product.create({
            data: {
              id, slug, name: p.name, category: getCategory(code, p.name),
              shortDescription: p.name + '. Produit Chogan.',
              longDescription: [p.name + '. Produit officiel Chogan.'],
              regularPrice: price_fcfa, publicPrice, stock: 0, lowStockThreshold: 5,
              isOfficial: true, choganCode: code, colorFrom: '#1d2f4f', colorTo: '#d9a99d'
            }
          });
          countNew++;
        }
      }
      revalidatePath('/admin/produits');
      return { success: true, countNew, countUpdated };
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet("Catalogue") || workbook.worksheets[0];
    if (!worksheet) return { success: false, error: "Le fichier Excel est vide." };
    
    let countNew = 0;
    let countUpdated = 0;
    
    const headerRow = worksheet.getRow(1).values as string[];
    let refIdx = -1;
    let nameIdx = -1;
    let priceIdx = -1;
    
    headerRow.forEach((val, idx) => {
      if (!val) return;
      const v = String(val).toLowerCase();
      if (v.includes("réf") || v.includes("ref") || v.includes("code") || v.includes("codice")) refIdx = idx;
      else if (v.includes("produit") || v.includes("nom") || v.includes("article")) nameIdx = idx;
      else if (v.includes("nouveau prix jamaal") || v.includes("prix public") || v.includes("prix fcfa") || v.includes("nouveau prix")) priceIdx = idx;
    });
    
    if (refIdx === -1 || nameIdx === -1 || priceIdx === -1) {
      return { success: false, error: "Colonnes introuvables. Assurez-vous d'avoir Réf., Produit et Nouveau prix JAMAAL (ou équivalent)." };
    }
    
    const rows: any[] = [];
    worksheet.eachRow((row, rowNumber) => { rows.push({ row, rowNumber }); });
    
    for (const { row, rowNumber } of rows) {
      if (rowNumber === 1) continue; // Skip header
      
      const code = String(row.getCell(refIdx).value || "").trim();
      const name = String(row.getCell(nameIdx).value || "").trim();
      let priceVal: any = row.getCell(priceIdx).value;
      
      if (!code || !name || priceVal === null || priceVal === undefined) continue;
      if (code.toLowerCase() === "code" || code.toLowerCase() === "ref.") continue;
      
      let price_fcfa = 0;
      if (typeof priceVal === "number") price_fcfa = priceVal;
      else if (typeof priceVal === "object" && priceVal.result) price_fcfa = Number(priceVal.result);
      else price_fcfa = Number(String(priceVal).replace(/[^\d]/g, ""));
      
      if (isNaN(price_fcfa) || price_fcfa <= 0) continue;
      
      const publicPrice = Math.round(price_fcfa / 1.25);
      const slug = slugify(name) + "-" + code.toLowerCase();
      const id = "chogan-" + code;
      
      const existing = await prisma.product.findFirst({
        where: {
          OR: [
            { choganCode: code },
            { id: id }
          ]
        }
      });
      
      if (existing) {
        if (existing.regularPrice !== price_fcfa) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              regularPrice: price_fcfa,
              publicPrice: publicPrice,
            }
          });
          countUpdated++;
        }
      } else {
        await prisma.product.create({
          data: {
            id,
            slug,
            name,
            category: getCategory(code, name),
            shortDescription: name + ". Produit Chogan.",
            longDescription: [name + ". Produit officiel Chogan."],
            regularPrice: price_fcfa,
            publicPrice: publicPrice,
            stock: 0,
            lowStockThreshold: 5,
            isOfficial: true,
            choganCode: code,
            colorFrom: "#1d2f4f",
            colorTo: "#d9a99d"
          }
        });
        countNew++;
      }
    }
    
    revalidatePath("/admin/produits");
    return { success: true, countNew, countUpdated };
    
  } catch (error: any) {
    console.error("Import error:", error);
    return { success: false, error: error.message };
  }
}
