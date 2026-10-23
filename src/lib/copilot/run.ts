/**
 * Copilote de vente (serveur) : rassemble les données d'un consultant (ses clients, anniversaires, paniers
 * abandonnés, filleuls), calcule ses 5 actions du jour, et les lui envoie chaque matin sur WhatsApp.
 * Le plan du jour est gardé (Setting) pour que la page « Mes actions du jour » montre exactement le même.
 */
import { prisma } from "@/lib/prisma";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { ordersByPhoneSince, phoneTail } from "@/lib/phone-match";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";
import { productOfTheDay } from "@/lib/automation/morning-kit";
import { buildCopilotPlan, copilotWhatsAppText, RELANCE_MAX_DAYS, RELANCE_MIN_DAYS, type CopilotAction, type CopilotInput } from "./plan";

const DAY = 86_400_000;
const dayKey = (now: Date) => now.toISOString().slice(0, 10);
const planKey = (consultantId: string, now: Date) => `copilote:${consultantId}:${dayKey(now)}`;
const doneKey = (consultantId: string, key: string) => `copilote:${consultantId}:${key}`;

async function inputFor(consultantId: string, origin: string, now: Date): Promise<CopilotInput | null> {
  const c = await prisma.consultant.findUnique({ where: { id: consultantId }, select: { id: true, name: true, slug: true, active: true } });
  if (!c?.active) return null;
  const mmdd = now.toISOString().slice(5, 10);
  const [orders, birthdayRows, carts, filleuls, done, product] = await Promise.all([
    prisma.order.findMany({
      where: { consultantId, status: { not: "ANNULEE" }, customerPhone: { not: null }, createdAt: { gte: new Date(now.getTime() - (RELANCE_MAX_DAYS + 30) * DAY) } },
      select: { id: true, customerName: true, customerPhone: true, createdAt: true, items: { select: { productName: true, product: { select: { slug: true } } }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.customer.findMany({ where: { birthday: mmdd, whatsappOptOut: false, orders: { some: { consultantId } } }, select: { name: true, phone: true }, take: 10 }),
    prisma.abandonedCart.findMany({
      where: { consultantId, orderedAt: null, updatedAt: { gte: new Date(now.getTime() - 7 * DAY), lte: new Date(now.getTime() - 3 * 3_600_000) } },
      select: { id: true, phone: true, name: true, total: true, items: true, updatedAt: true },
      orderBy: { total: "desc" },
      take: 10,
    }),
    prisma.consultant.findMany({ where: { sponsorId: consultantId, active: true }, select: { id: true, name: true, whatsapp: true, createdAt: true }, take: 50 }),
    prisma.automationSent.findMany({ where: { key: { startsWith: `copilote:${consultantId}:` } }, select: { key: true } }),
    productOfTheDay(now).catch(() => null),
  ]);

  // Clients à relancer : ignorés s'ils ont racheté depuis (chez n'importe qui).
  const lastByPhone = new Map<string, (typeof orders)[number]>();
  for (const o of orders) {
    const k = phoneTail(o.customerPhone);
    if (k && !lastByPhone.has(k)) lastByPhone.set(k, o);
  }
  const relanceOrders: CopilotInput["orders"] = [];
  for (const o of lastByPhone.values()) {
    const age = (now.getTime() - o.createdAt.getTime()) / DAY;
    if (age < RELANCE_MIN_DAYS || age > RELANCE_MAX_DAYS) continue;
    if ((await ordersByPhoneSince(o.customerPhone!, o.createdAt)) > 0) continue;
    relanceOrders.push({ id: o.id, phone: o.customerPhone!, name: o.customerName, createdAt: o.createdAt, products: o.items.map((i) => i.productName), productSlug: o.items[0]?.product?.slug ?? null });
  }

  const sales = filleuls.length
    ? await prisma.order.groupBy({ by: ["consultantId"], where: { consultantId: { in: filleuls.map((f) => f.id) }, status: { not: "ANNULEE" } }, _count: { _all: true }, _max: { createdAt: true } })
    : [];
  const salesOf = new Map(sales.map((s) => [s.consultantId!, s]));

  const optedOutRows = await prisma.customer.findMany({ where: { whatsappOptOut: true }, select: { phone: true } });
  const prefix = `copilote:${consultantId}:`;

  return {
    consultant: { name: c.name, slug: c.slug },
    origin,
    now,
    orders: relanceOrders,
    birthdays: birthdayRows.map((b) => ({ name: b.name, phone: b.phone })),
    carts: carts.map((k) => ({
      id: k.id,
      phone: k.phone,
      name: k.name,
      total: k.total,
      updatedAt: k.updatedAt,
      products: Array.isArray(k.items) ? (k.items as { name?: string; productName?: string }[]).map((i) => i.name ?? i.productName ?? "").filter(Boolean) : [],
    })),
    filleuls: filleuls.filter((f) => f.whatsapp).map((f) => ({ id: f.id, name: f.name, whatsapp: f.whatsapp, joinedAt: f.createdAt, sales: salesOf.get(f.id)?._count._all ?? 0, lastSaleAt: salesOf.get(f.id)?._max.createdAt ?? null })),
    product: product ? { name: product.name, slug: product.slug } : null,
    done: new Set(done.map((d) => d.key.slice(prefix.length))),
    optedOut: new Set(optedOutRows.map((r) => phoneTail(r.phone)).filter(Boolean)),
  };
}

/** Plan du jour : celui envoyé ce matin s'il existe, sinon calculé maintenant (sans rien marquer). */
export async function copilotPlanFor(consultantId: string, origin: string, now = new Date()): Promise<CopilotAction[]> {
  const stored = await prisma.setting.findUnique({ where: { key: planKey(consultantId, now) } }).catch(() => null);
  if (stored) {
    try {
      return JSON.parse(stored.value) as CopilotAction[];
    } catch {
      // plan illisible : recalculé
    }
  }
  const input = await inputFor(consultantId, origin, now);
  return input ? buildCopilotPlan(input) : [];
}

/** Calcule, mémorise et marque le plan du jour (les actions ne seront pas reproposées les jours suivants). */
async function commitPlan(consultantId: string, origin: string, now: Date): Promise<CopilotAction[]> {
  const input = await inputFor(consultantId, origin, now);
  if (!input) return [];
  const plan = buildCopilotPlan(input);
  const value = JSON.stringify(plan);
  await prisma.setting.upsert({ where: { key: planKey(consultantId, now) }, create: { key: planKey(consultantId, now), value }, update: { value } });
  for (const a of plan) if (a.type !== "statut") await claimAutomation(doneKey(consultantId, a.key));
  return plan;
}

/** Tâche du matin : les actions du jour de chaque consultant actif, sur WhatsApp. */
export async function sendCopilots(origin: string, now = new Date(), opts: { budgetMs?: number } = {}) {
  if (!(await automationEnabled("copilot"))) return "désactivé";
  const started = Date.now();
  const site = origin.replace(/\/$/, "");
  const live = whatsappConfig().active;
  const consultants = await prisma.consultant.findMany({ where: { active: true, kitMatin: true }, select: { id: true, name: true, whatsapp: true } });
  let sent = 0;
  let plans = 0;
  for (const c of consultants) {
    if (Date.now() - started > (opts.budgetMs ?? 30_000)) break;
    if (!(await claimAutomation(`copilote-envoi:${dayKey(now)}:${c.id}`))) continue;
    try {
      const plan = await commitPlan(c.id, site, now);
      plans++;
      // Rien d'autre que le statut : pas de message (le kit du matin s'en charge déjà).
      if (!live || !c.whatsapp || !plan.some((a) => a.type !== "statut")) continue;
      await sendWhatsApp({ to: c.whatsapp, kind: "reseller", text: copilotWhatsAppText(c.name, plan), cta: { label: "Mes actions du jour", url: `${site}/admin/copilote` } });
      sent++;
    } catch (e) {
      console.error("[copilote]", c.id, e);
    }
  }
  return { plans, envoyes: sent };
}
