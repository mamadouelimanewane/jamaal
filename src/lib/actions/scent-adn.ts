"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { startingPrice } from "@/lib/reseller-catalog";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { canonicalizePhone, phoneLookupVariants } from "@/lib/phone";
import { matchScents, parseAdnAnswers, profileSummary, type AdnProfile } from "@/lib/scent/adn";

export type AdnMatchView = { id: string; slug: string; name: string; inspiredBy: string | null; photo: string | null; price: number | null; percent: number; reason: string; direct: boolean };
export type AdnResult = { ok: true; profile: AdnProfile; summary: string; matches: AdnMatchView[]; saved: boolean } | { ok: false; error: string };

const ADN_COOKIE = "jamaal_adn";

async function perfumeCatalog() {
  return prisma.product.findMany({
    where: { category: { startsWith: "parfum" } },
    select: { id: true, slug: true, name: true, category: true, inspiredBy: true, inspiredBrand: true, family: true, topNotes: true, heartNotes: true, baseNotes: true, photo: true, regularPrice: true, volumes: true },
    orderBy: { reviewCount: "desc" },
    take: 1500,
  });
}

/** Calcule le « Parfum ADN » et, si un numéro est donné, l'enregistre sur la fiche client (conseils et relances). */
export async function discoverScentAdn(input: Record<string, unknown>): Promise<AdnResult> {
  const answers = parseAdnAnswers(input);
  if (!answers.worn.length && !answers.families.length) return { ok: false, error: "Citez au moins un parfum que vous aimez, ou choisissez une famille d'odeurs." };
  const limited = await rateLimit(`adn:${clientIpFromHeaders(await headers())}`, { limit: 20, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Beaucoup de recherches depuis votre connexion : réessayez dans un moment." };

  const catalog = await perfumeCatalog().catch(() => [] as Awaited<ReturnType<typeof perfumeCatalog>>);
  const { profile, matches } = matchScents(answers, catalog, 3);
  const summary = profileSummary(profile);
  const views: AdnMatchView[] = matches.map((m) => {
    const row = catalog.find((r) => r.id === m.product.id)!;
    return { id: row.id, slug: row.slug, name: row.name, inspiredBy: row.inspiredBy ?? null, photo: row.photo ?? null, price: startingPrice(row.regularPrice, row.volumes), percent: m.percent, reason: m.reason, direct: m.direct };
  });

  const stored = { ...profile, intensity: answers.intensity, moment: answers.moment, picks: views.map((v) => v.slug), at: new Date().toISOString() };
  (await cookies()).set(ADN_COOKIE, encodeURIComponent(JSON.stringify({ s: summary.slice(0, 300), p: stored.picks })), { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });

  let saved = false;
  const rawPhone = String(input.phone ?? "").trim();
  if (rawPhone.replace(/\D/g, "").length >= 9) {
    const phone = canonicalizePhone(rawPhone);
    const name = String(input.name ?? "").trim().slice(0, 80) || "Client Parfum ADN";
    try {
      const existing = await prisma.customer.findFirst({ where: { phone: { in: phoneLookupVariants(rawPhone) } }, select: { id: true } });
      if (existing) await prisma.customer.update({ where: { id: existing.id }, data: { scentProfile: stored } });
      else await prisma.customer.create({ data: { name, phone, scentProfile: stored } });
      saved = true;
    } catch (e) {
      console.error("[parfum-adn]", e);
    }
  }
  return { ok: true, profile, summary, matches: views, saved };
}
