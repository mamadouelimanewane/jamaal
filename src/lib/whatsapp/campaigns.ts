/**
 * Campagnes WhatsApp : un message (personnalisé avec {prenom}) envoyé à une audience filtrée
 * — clients (inactifs depuis N jours, acheteurs d'une catégorie, clients d'un revendeur) ou
 * revendeurs actifs. Les clients ayant répondu STOP sont exclus. Envoi par lots, reprenable :
 * un numéro déjà servi pour cette campagne n'est jamais relancé.
 */
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizePhone } from "@/lib/phone";
import { phoneTail } from "@/lib/phone-match";
import { sendWhatsApp } from "./index";
import { assignCampaignRecipientAttributes } from "./kwingo-bridge";

export interface CampaignRecipient {
  phone: string;
  name: string;
  consultantId?: string | null;
  consultantName?: string | null;
  source?: "BASE" | "EXCEL";
}

export type CampaignSourceMode = "FILTRES" | "EXCEL" | "FILTRES_ET_EXCEL";

export interface CampaignAudience {
  target: "CLIENTS" | "REVENDEURS";
  /** Clients sans commande depuis N jours (0 = tous). */
  inactiveDays?: number;
  /** Clients ayant acheté dans cette catégorie. */
  category?: string;
  /** Clients rattachés à ce revendeur. */
  consultantId?: string;
  /** Bouton lien facultatif. */
  cta?: { label: string; url: string } | null;
  /** Modèle Meta approuvé sélectionné pour l'envoi Cloud API. */
  templateName?: string;
  /** Code langue du modèle Meta approuvé (ex. fr, en_US, en). */
  templateLanguage?: string;
  /** Mode de sélection des destinataires : filtres seuls, fichier Excel seul, ou les deux combinés. */
  sourceMode?: CampaignSourceMode;
  /** Destinataires importés depuis un fichier Excel (.xlsx) ou CSV. */
  excelRecipients?: CampaignRecipient[];
  /** Nom du fichier Excel importé. */
  excelFileName?: string;
}

export function parseAudience(raw: unknown): CampaignAudience {
  const a = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown, n = 80) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const cta = a.cta as { label?: unknown; url?: unknown } | null | undefined;
  const url = s(cta?.url, 300);

  const parsed: CampaignAudience = {
    target: a.target === "REVENDEURS" ? "REVENDEURS" : "CLIENTS",
    inactiveDays: Math.max(0, Math.min(3650, Math.round(Number(a.inactiveDays) || 0))),
    category: s(a.category) || undefined,
    consultantId: s(a.consultantId) || undefined,
    cta: url && /^https:\/\//.test(url) ? { label: s(cta?.label, 20) || "Voir", url } : null,
  };

  const tplName = s(a.templateName, 120);
  const tplLang = s(a.templateLanguage, 20);
  if (tplName) parsed.templateName = tplName;
  if (tplLang) parsed.templateLanguage = tplLang;

  if (a.sourceMode === "EXCEL" || a.sourceMode === "FILTRES_ET_EXCEL" || a.sourceMode === "FILTRES") {
    parsed.sourceMode = a.sourceMode;
  }

  if (Array.isArray(a.excelRecipients) && a.excelRecipients.length > 0) {
    const cleanExcel: CampaignRecipient[] = [];
    for (const item of a.excelRecipients.slice(0, 5000)) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const phone = canonicalizePhone(String(rec.phone ?? ""));
      if (!phone || phone.length < 8) continue;
      cleanExcel.push({
        phone,
        name: s(rec.name, 120) || "Client",
        consultantId: s(rec.consultantId, 60) || null,
        consultantName: s(rec.consultantName, 120) || null,
        source: "EXCEL",
      });
    }
    if (cleanExcel.length > 0) {
      parsed.excelRecipients = cleanExcel;
    }
  }

  const fileName = s(a.excelFileName, 160);
  if (fileName) parsed.excelFileName = fileName;

  return parsed;
}

/** Message personnalisé (pur, testé) : {prenom} et {nom}. */
export function personalize(body: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  return body.replace(/\{prenom\}/gi, first).replace(/\{nom\}/gi, name.trim()).replace(/[ \t]+([,.])/g, "$1").trim();
}

/**
 * Extrait et normalise une liste de destinataires depuis un fichier Excel (.xlsx) ou CSV (.csv),
 * exclut les clients ayant répondu STOP (whatsappOptOut), et rattache automatiquement leur consultant.
 */
export async function parseCampaignExcelBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  defaultConsultantId?: string,
): Promise<{
  recipients: CampaignRecipient[];
  rawCount: number;
  skippedInvalid: number;
  excludedOptOut: number;
}> {
  const rawPairs: { phone: string; name: string; consultantHint?: string }[] = [];
  const lowerName = fileName.toLowerCase();

  const extractCellText = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string" || typeof val === "number") return String(val).trim();
    if (typeof val === "object") {
      const obj = val as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
      if (typeof obj.text === "string") return obj.text.trim();
      if (obj.result !== undefined) return String(obj.result).trim();
      if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text ?? "").join("").trim();
    }
    return String(val).trim();
  };

  const rowsMatrix: string[][] = [];

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const text = Buffer.from(arrayBuffer).toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length > 0) {
      const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
      for (const line of lines) {
        const cells = line.split(sep).map((c) => c.replace(/^["'\uFEFF]+|["']+$/g, "").trim());
        rowsMatrix.push(cells);
      }
    }
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (worksheet) {
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cells = vals.map((v) => extractCellText(v));
        if (cells.some((c) => c.length > 0)) {
          rowsMatrix.push(cells);
        }
      });
    }
  }

  if (rowsMatrix.length === 0) {
    return { recipients: [], rawCount: 0, skippedInvalid: 0, excludedOptOut: 0 };
  }

  // Détection intelligente de l'en-tête ou des colonnes (Téléphone, Nom,Prénom, Consultant)
  const firstRowLower = rowsMatrix[0].map((c) =>
    c
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );

  let phoneIdx = firstRowLower.findIndex((h) =>
    /tel|phone|whatsapp|numero|mobile|contact|portable|cel|gsm/.test(h),
  );
  let nameIdx = firstRowLower.findIndex((h) => /nom|name|client|destinataire/.test(h));
  const firstNameIdx = firstRowLower.findIndex((h) => /prenom|first/.test(h));
  const consultantIdx = firstRowLower.findIndex((h) => /consultant|parrain|revendeur|conseiller/.test(h));

  const hasHeader =
    phoneIdx !== -1 ||
    nameIdx !== -1 ||
    firstNameIdx !== -1 ||
    firstRowLower.some((h) => !/\d{7,}/.test(h) && /nom|tel|phone|whatsapp|client/.test(h));

  const startRow = hasHeader ? 1 : 0;

  for (let i = startRow; i < rowsMatrix.length; i++) {
    const cells = rowsMatrix[i];
    if (!cells || cells.length === 0) continue;

    let rawPhone = "";
    let rawName = "";
    let consultantHint = "";

    if (phoneIdx !== -1 && cells[phoneIdx]) {
      rawPhone = cells[phoneIdx];
    } else {
      // Chercher la première cellule qui ressemble à un numéro de téléphone (>= 8 chiffres)
      const foundIdx = cells.findIndex((c) => c.replace(/\D/g, "").length >= 8);
      if (foundIdx !== -1) {
        rawPhone = cells[foundIdx];
        if (nameIdx === -1) {
          const otherIdx = cells.findIndex((c, idx) => idx !== foundIdx && c.trim().length >= 2 && !/^\+?\d+$/.test(c.trim()));
          if (otherIdx !== -1) rawName = cells[otherIdx];
        }
      }
    }

    if (firstNameIdx !== -1 && nameIdx !== -1 && firstNameIdx !== nameIdx) {
      rawName = `${cells[firstNameIdx] ?? ""} ${cells[nameIdx] ?? ""}`.trim();
    } else if (nameIdx !== -1 && cells[nameIdx]) {
      rawName = cells[nameIdx];
    } else if (firstNameIdx !== -1 && cells[firstNameIdx]) {
      rawName = cells[firstNameIdx];
    }

    if (consultantIdx !== -1 && cells[consultantIdx]) {
      consultantHint = cells[consultantIdx];
    }

    rawPairs.push({ phone: rawPhone, name: rawName, consultantHint });
  }

  let skippedInvalid = 0;
  let excludedOptOut = 0;
  const dedupedByTail = new Map<string, { phone: string; name: string; consultantHint?: string }>();

  for (const item of rawPairs) {
    const cleanPhone = canonicalizePhone(item.phone);
    const tail = phoneTail(cleanPhone);
    if (!cleanPhone || cleanPhone.length < 8 || !tail) {
      skippedInvalid++;
      continue;
    }
    if (!dedupedByTail.has(tail)) {
      dedupedByTail.set(tail, {
        phone: cleanPhone,
        name: item.name.trim(),
        consultantHint: item.consultantHint?.trim(),
      });
    }
  }

  const tails = Array.from(dedupedByTail.keys());
  if (tails.length === 0) {
    return { recipients: [], rawCount: rawPairs.length, skippedInvalid, excludedOptOut: 0 };
  }

  // Enrichissement depuis la base JAMAAL (vérification STOP whatsappOptOut + rattachement consultant)
  const [customers, allConsultants] = await Promise.all([
    prisma.$queryRaw<
      {
        tail: string;
        name: string;
        whatsappOptOut: boolean;
        consultantId: string | null;
        consultantName: string | null;
      }[]
    >`
      SELECT
        right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9) AS tail,
        c.name,
        c."whatsappOptOut",
        coalesce(c."consultantId", last_ord."consultantId") AS "consultantId",
        cons.name AS "consultantName"
      FROM "Customer" c
      LEFT JOIN LATERAL (
        SELECT o."consultantId"
        FROM "Order" o
        JOIN "Consultant" oc ON oc.id = o."consultantId" AND oc.active = true
        WHERE o."customerId" = c.id
          AND o.status <> 'ANNULEE'
          AND o."consultantId" IS NOT NULL
        ORDER BY o."createdAt" DESC
        LIMIT 1
      ) last_ord ON true
      LEFT JOIN "Consultant" cons
        ON cons.id = coalesce(c."consultantId", last_ord."consultantId")
       AND cons.active = true
      WHERE right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 9) IN (${Prisma.join(tails)})
    `.catch(() => []),
    prisma.consultant.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const customerByTail = new Map(customers.map((c) => [c.tail, c]));
  const defaultConsultant = defaultConsultantId
    ? allConsultants.find((c) => c.id === defaultConsultantId) ?? null
    : null;

  const recipients: CampaignRecipient[] = [];
  for (const [tail, item] of dedupedByTail.entries()) {
    const dbCust = customerByTail.get(tail);
    if (dbCust?.whatsappOptOut) {
      excludedOptOut++;
      continue;
    }

    let resolvedConsId: string | null = defaultConsultant?.id ?? dbCust?.consultantId ?? null;
    let resolvedConsName: string | null = defaultConsultant?.name ?? dbCust?.consultantName ?? null;

    if (!resolvedConsId && item.consultantHint) {
      const hintLower = item.consultantHint.toLowerCase();
      const matchedCons = allConsultants.find(
        (c) =>
          c.id === item.consultantHint ||
          (c.slug && c.slug.toLowerCase() === hintLower) ||
          c.name.toLowerCase().includes(hintLower),
      );
      if (matchedCons) {
        resolvedConsId = matchedCons.id;
        resolvedConsName = matchedCons.name;
      }
    }

    recipients.push({
      phone: item.phone,
      name: item.name || dbCust?.name || "Client",
      consultantId: resolvedConsId,
      consultantName: resolvedConsName,
      source: "EXCEL",
    });
  }

  return {
    recipients,
    rawCount: rawPairs.length,
    skippedInvalid,
    excludedOptOut,
  };
}

/** Destinataires (un par numéro, sur les 9 derniers chiffres) avec leur consultant rattaché pour l'assignation des retours. */
export async function campaignRecipients(a: CampaignAudience): Promise<CampaignRecipient[]> {
  let dbRows: CampaignRecipient[] = [];
  const mode: CampaignSourceMode = a.sourceMode ?? "FILTRES";

  if (mode !== "EXCEL") {
    if (a.target === "REVENDEURS") {
      dbRows = (await prisma.consultant.findMany({ where: { active: true }, select: { id: true, whatsapp: true, name: true } })).map((c) => ({
        phone: c.whatsapp,
        name: c.name,
        consultantId: c.id,
        consultantName: c.name,
        source: "BASE" as const,
      }));
    } else {
      const conds: Prisma.Sql[] = [Prisma.sql`c."whatsappOptOut" = false`];
      if (a.inactiveDays) {
        const since = new Date(Date.now() - a.inactiveDays * 86_400_000);
        conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o.status <> 'ANNULEE')`);
        conds.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o.status <> 'ANNULEE' AND o."createdAt" >= ${since})`);
      }
      if (a.category) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id JOIN "Product" p ON p.id = i."productId" WHERE o."customerId" = c.id AND o.status <> 'ANNULEE' AND p.category = ${a.category})`);
      if (a.consultantId) conds.push(Prisma.sql`(c."consultantId" = ${a.consultantId} OR EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o.status <> 'ANNULEE' AND o."consultantId" = ${a.consultantId}))`);
      dbRows = await prisma.$queryRaw<CampaignRecipient[]>`
        SELECT
          c.phone,
          c.name,
          coalesce(${a.consultantId ?? null}, c."consultantId", last_ord."consultantId") AS "consultantId",
          cons.name AS "consultantName"
        FROM "Customer" c
        LEFT JOIN LATERAL (
          SELECT o."consultantId"
          FROM "Order" o
          JOIN "Consultant" oc ON oc.id = o."consultantId" AND oc.active = true
          WHERE o."customerId" = c.id
            AND o.status <> 'ANNULEE'
            AND o."consultantId" IS NOT NULL
          ORDER BY o."createdAt" DESC
          LIMIT 1
        ) last_ord ON true
        LEFT JOIN "Consultant" cons
          ON cons.id = coalesce(${a.consultantId ?? null}, c."consultantId", last_ord."consultantId")
         AND cons.active = true
        WHERE ${Prisma.join(conds, " AND ")}
        ORDER BY c."createdAt" ASC
        LIMIT 5000`;
    }
  }

  const excelRows: CampaignRecipient[] =
    mode === "EXCEL" || mode === "FILTRES_ET_EXCEL" || (a.excelRecipients && a.excelRecipients.length > 0)
      ? (a.excelRecipients ?? []).map((r) => ({
          ...r,
          consultantId: r.consultantId ?? a.consultantId ?? null,
          source: "EXCEL" as const,
        }))
      : [];

  const combined = mode === "EXCEL" ? excelRows : [...dbRows, ...excelRows];
  const seen = new Set<string>();
  return combined.filter((r) => {
    const t = phoneTail(r.phone);
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/** Envoie (ou continue) une campagne pendant budgetMs ; renvoie l'état. */
export async function runCampaign(id: string, budgetMs = 45_000): Promise<{ sent: number; failed: number; total: number; done: boolean }> {
  const c = await prisma.whatsAppCampaign.findUnique({ where: { id } });
  if (!c) throw new Error("Campagne introuvable.");
  const audience = parseAudience(c.audience);
  const recipients = await campaignRecipients(audience);
  const already = new Set((await prisma.whatsAppMessage.findMany({ where: { campaignId: id }, select: { toNumber: true } })).map((m) => phoneTail(m.toNumber)));
  await prisma.whatsAppCampaign.update({ where: { id }, data: { status: "EN_COURS", total: recipients.length } });
  const started = Date.now();
  let done = true;
  const chosenTemplate = audience.templateName || process.env.WHATSAPP_TEMPLATE_MARKETING || "test_lancement_produit";
  const chosenLanguage = audience.templateLanguage || "fr";

  for (const r of recipients) {
    if (already.has(phoneTail(r.phone))) continue;
    if (Date.now() - started > budgetMs) {
      done = false;
      break;
    }
    // Poser les attributs de contact (consultant_id, assigned_to, campaign_id) sur le fil et synchroniser avec KwingoChat
    // afin que tout retour du client soit automatiquement assigné à son consultant (ou reste dans unassigned s'il n'en a pas).
    await assignCampaignRecipientAttributes({
      phone: r.phone,
      name: r.name,
      consultantId: r.consultantId ?? audience.consultantId ?? null,
      campaignId: id,
      campaignTitle: c.title,
    });
    await sendWhatsApp({
      to: r.phone,
      kind: "campagne",
      campaignId: id,
      recipientName: r.name,
      text: personalize(c.body, r.name),
      free: false,
      template: chosenTemplate,
      templateLanguage: chosenLanguage,
      ...(audience.cta ? { cta: audience.cta } : {}),
    });
  }
  const [sent, failed] = await Promise.all([
    prisma.whatsAppMessage.count({ where: { campaignId: id, status: { not: "ECHEC" } } }),
    prisma.whatsAppMessage.count({ where: { campaignId: id, status: "ECHEC" } }),
  ]);
  await prisma.whatsAppCampaign.update({ where: { id }, data: { sent, failed, status: done ? "ENVOYEE" : "EN_COURS", ...(done ? { sentAt: new Date() } : {}) } });
  return { sent, failed, total: recipients.length, done };
}
