import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { minWithdrawal, walletBalance, type Owner } from "@/lib/wallet";
import { getDepositNumbers } from "@/lib/wallet-settings";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { WALLET_LABELS } from "@/lib/payouts/providers";
import { payoutChannels } from "@/lib/business-model";
import { formatPrice } from "@/lib/currency";
import { WalletActions } from "@/components/admin/WalletActions";
import { LivreurWalletForm } from "@/components/admin/LivreurWalletForm";
import { ListenButton } from "./Listen";

/** Mouvements du wallet en images (même code couleur partout dans l'application Livreur). */
const KIND: Record<string, { emoji: string; label: string; bg: string }> = {
  LIVRAISON: { emoji: "🪙", label: "Ma part d'une course", bg: "#CCFBF1" },
  ENCAISSEMENT: { emoji: "💵", label: "Argent reçu du client (à rendre)", bg: "#FEF3C7" },
  REVERSEMENT: { emoji: "🤝", label: "Argent rendu à JAMAAL", bg: "#DCFCE7" },
  RETRAIT: { emoji: "💸", label: "Retrait vers mon téléphone", bg: "#DBEAFE" },
  DEPOT: { emoji: "➕", label: "Dépôt sur mon wallet", bg: "#DCFCE7" },
  AJUSTEMENT: { emoji: "⚙️", label: "Correction JAMAAL", bg: "#F3F4F6" },
  ANNULATION: { emoji: "↩️", label: "Annulation", bg: "#FEE2E2" },
  PRIME: { emoji: "🎁", label: "Prime", bg: "#FCE7F3" },
  COMMISSION: { emoji: "🪙", label: "Commission", bg: "#CCFBF1" },
};
const STATUS: Record<string, string> = { EN_ATTENTE: "⏳ en cours", ECHEC: "❌ échoué", ANNULE: "❌ annulé" };

const TZ = "Africa/Dakar";
const dayKey = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: TZ });
function dayTitle(key: string, now: Date) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  if (key === today) return "Aujourd'hui";
  if (key === yesterday) return "Hier";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}
const hour = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
function groupByDay<T>(rows: T[], at: (r: T) => Date) {
  const out: { key: string; rows: T[] }[] = [];
  for (const r of rows) {
    const k = dayKey(at(r));
    const g = out.at(-1);
    if (g && g.key === k) g.rows.push(r);
    else out.push({ key: k, rows: [r] });
  }
  return out;
}

/**
 * Wallet et historique du livreur, pensés pour être compris d'un coup d'œil : solde en très gros (ou l'argent
 * à rendre à JAMAAL), gains en images, et deux historiques jour par jour — ses courses et son argent.
 */
export async function LivreurWallet({ owner, viewAs, depot, tab }: { owner: Owner; viewAs: boolean; depot?: string; tab: "courses" | "argent" }) {
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const [bal, tx, courses, earnMonth, earnWeek, earnAll, min, numbers, model, acct] = await Promise.all([
    walletBalance(owner),
    prisma.walletTransaction.findMany({ where: { ownerType: "LIVREUR", ownerId: owner.id }, orderBy: { createdAt: "desc" }, take: 150 }),
    prisma.order.findMany({
      where: { livreurId: owner.id, deliveryStatus: { in: ["LIVREE", "ECHEC"] } },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: { id: true, customerName: true, deliveryContactName: true, address: true, deliveryPlace: true, deliveryStatus: true, deliveredAt: true, updatedAt: true, livreurShare: true, total: true, paymentRef: true, deliveredDistanceM: true },
    }),
    prisma.livreurEarning.aggregate({ where: { livreurId: owner.id, createdAt: { gte: month }, status: { not: "ANNULE" } }, _sum: { amount: true }, _count: true }),
    prisma.livreurEarning.aggregate({ where: { livreurId: owner.id, createdAt: { gte: week }, status: { not: "ANNULE" } }, _sum: { amount: true }, _count: true }),
    prisma.livreurEarning.aggregate({ where: { livreurId: owner.id, status: { not: "ANNULE" } }, _sum: { amount: true }, _count: true }),
    minWithdrawal(),
    getDepositNumbers(),
    getBusinessModel(),
    prisma.livreur.findUnique({ where: { id: owner.id }, select: { walletProvider: true, walletNumber: true } }),
  ]);
  const owed = Math.max(0, -bal.balance);
  const account = acct?.walletProvider && acct.walletNumber ? `${WALLET_LABELS[acct.walletProvider as "WAVE"] ?? acct.walletProvider} ${acct.walletNumber}` : null;
  const online = getAvailablePaymentProviders(model).map((p) => p.id);
  const channels = payoutChannels(model);
  const say = owed
    ? `Vous devez rendre ${owed} francs à JAMAAL. C'est l'argent reçu des clients, moins vos gains. Rendez-le au dépôt, ou touchez Rendre l'argent pour payer avec Wave ou Orange Money.`
    : `Vous avez ${bal.available} francs dans votre wallet. Ce mois, vous avez gagné ${earnMonth._sum.amount ?? 0} francs avec ${earnMonth._count} courses. Touchez Retirer pour recevoir votre argent sur votre téléphone.`;

  return (
    <div className="space-y-5">
      {depot === "ok" && <p role="status" className="rounded-2xl bg-[#DCFCE7] px-4 py-3 text-base font-bold text-[#14532D]">✅ Paiement reçu : votre wallet est mis à jour dans un instant.</p>}
      {depot === "annule" && <p className="rounded-2xl bg-[#FEF3C7] px-4 py-3 text-base font-bold text-[#78350F]">Dépôt annulé : rien n&apos;a été pris.</p>}

      <section className={`relative overflow-hidden rounded-3xl p-5 text-white ${owed ? "bg-gradient-to-br from-[#B45309] to-[#C2410C]" : "bg-gradient-to-br from-[#0F766E] via-[#15803D] to-[#1d2f4f]"}`}>
        <span className="pointer-events-none absolute -right-2 -top-3 text-8xl opacity-20" aria-hidden="true">{owed ? "💵" : "👛"}</span>
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-base font-bold">{owed ? "Argent à rendre à JAMAAL" : "Mon argent disponible"}</p>
          <ListenButton text={say} tone="dark" />
        </div>
        <p className="relative mt-1 text-5xl font-extrabold tracking-tight">{formatPrice(owed || bal.available)}</p>
        {owed > 0 ? (
          <p className="relative mt-2 text-sm font-semibold text-white/90">Argent reçu des clients, moins vos gains. Rendez-le au dépôt JAMAAL, ou payez avec Wave / Orange Money.</p>
        ) : (
          bal.pendingOut > 0 && <p className="relative mt-2 text-sm font-semibold text-white/90">⏳ {formatPrice(bal.pendingOut)} en cours d&apos;envoi sur votre téléphone.</p>
        )}
        {!viewAs && (
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            {owed ? (
              <a href="#recharger" className="col-span-2 flex min-h-14 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-[#9A3412]">🤝 Rendre l&apos;argent</a>
            ) : (
              <>
                <a href="#retirer" className="flex min-h-14 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-[#14532D]">💸 Retirer</a>
                <a href="#recharger" className="flex min-h-14 items-center justify-center rounded-2xl bg-white/20 text-lg font-extrabold text-white">➕ Déposer</a>
              </>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center" aria-label="Mes gains">
        <div className="rounded-2xl bg-[#EDE9FE] p-3 text-[#4C1D95]"><span className="block text-xs font-bold">7 derniers jours</span><span className="block text-base font-extrabold sm:text-lg">{formatPrice(earnWeek._sum.amount ?? 0)}</span><span className="text-xs font-semibold">{earnWeek._count} course{earnWeek._count > 1 ? "s" : ""}</span></div>
        <div className="rounded-2xl bg-[#CCFBF1] p-3 text-[#134E4A]"><span className="block text-xs font-bold">Ce mois</span><span className="block text-base font-extrabold sm:text-lg">{formatPrice(earnMonth._sum.amount ?? 0)}</span><span className="text-xs font-semibold">{earnMonth._count} course{earnMonth._count > 1 ? "s" : ""}</span></div>
        <div className="rounded-2xl bg-[#FCE7F3] p-3 text-[#831843]"><span className="block text-xs font-bold">Depuis le début</span><span className="block text-base font-extrabold sm:text-lg">{formatPrice(earnAll._sum.amount ?? 0)}</span><span className="text-xs font-semibold">{earnAll._count} course{earnAll._count > 1 ? "s" : ""}</span></div>
      </section>

      {!viewAs && (
        <section className="rounded-3xl border-2 border-[#15803D] bg-white p-4">
          <WalletActions balance={bal.available} min={min} account={account} depositNumbers={numbers} onlineDeposit={{ WAVE: online.includes("wave"), ORANGE_MONEY: online.includes("orange_money") }} defaultTab={owed ? "recharger" : "retirer"} />
        </section>
      )}

      <section aria-labelledby="lv-historique">
        <h2 id="lv-historique" className="text-xl font-extrabold text-ink">🕑 Mon historique</h2>
        <div role="tablist" className="mt-3 grid grid-cols-2 gap-2">
          <Link role="tab" aria-selected={tab === "courses"} href="/admin/mon-wallet?onglet=courses#lv-historique" className={`flex min-h-14 items-center justify-center rounded-2xl text-lg font-extrabold ${tab === "courses" ? "bg-[#2563EB] text-white shadow-md" : "bg-cream text-navy"}`}>🛵 Mes courses</Link>
          <Link role="tab" aria-selected={tab === "argent"} href="/admin/mon-wallet?onglet=argent#lv-historique" className={`flex min-h-14 items-center justify-center rounded-2xl text-lg font-extrabold ${tab === "argent" ? "bg-[#0F766E] text-white shadow-md" : "bg-cream text-navy"}`}>👛 Mon argent</Link>
        </div>

        {tab === "courses" ? (
          courses.length === 0 ? (
            <Empty emoji="🛵" text="Pas encore de course terminée. Elles s'afficheront ici, jour par jour." />
          ) : (
            groupByDay(courses, (o) => o.deliveredAt ?? o.updatedAt).map((g) => (
              <div key={g.key} className="mt-4">
                <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy/70">{dayTitle(g.key, now)} · {g.rows.filter((o) => o.deliveryStatus === "LIVREE").length} livrée(s) · +{formatPrice(g.rows.reduce((s, o) => s + (o.deliveryStatus === "LIVREE" ? o.livreurShare : 0), 0))}</h3>
                <ul className="space-y-2">
                  {g.rows.map((o) => {
                    const ok = o.deliveryStatus === "LIVREE";
                    const cash = o.paymentRef?.startsWith("cod:");
                    return (
                      <li key={o.id} className={`flex items-center gap-3 rounded-2xl p-3 ${ok ? "bg-white" : "bg-[#FEF2F2]"}`}>
                        <span className="text-3xl" aria-hidden="true">{ok ? "✅" : "⚠️"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-extrabold text-ink">{o.deliveryContactName ?? o.customerName}</span>
                          <span className="block truncate text-sm text-navy/75">{hour(o.deliveredAt ?? o.updatedAt)} · {o.deliveryPlace ?? o.address ?? "—"}</span>
                          {ok && cash && <span className="block text-xs font-bold text-[#92400E]">💵 {formatPrice(o.total)} reçus du client</span>}
                          {!ok && <span className="block text-xs font-bold text-[#B91C1C]">Livraison impossible</span>}
                        </span>
                        {ok && o.livreurShare > 0 && <span className="shrink-0 rounded-full bg-[#CCFBF1] px-3 py-1 text-base font-extrabold text-[#134E4A]">+{formatPrice(o.livreurShare)}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )
        ) : tx.length === 0 ? (
          <Empty emoji="👛" text="Pas encore de mouvement. Votre part arrive ici après chaque course livrée." />
        ) : (
          groupByDay(tx, (t) => t.createdAt).map((g) => (
            <div key={g.key} className="mt-4">
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy/70">{dayTitle(g.key, now)}</h3>
              <ul className="space-y-2">
                {g.rows.map((t) => {
                  const k = KIND[t.kind] ?? { emoji: "•", label: t.kind, bg: "#F3F4F6" };
                  const off = t.status === "ANNULE" || t.status === "ECHEC";
                  return (
                    <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ background: k.bg }} aria-hidden="true">{k.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold text-ink">{k.label}</span>
                        <span className="block truncate text-sm text-navy/70">{hour(t.createdAt)}{t.orderId ? ` · course n° ${t.orderId.slice(-6).toUpperCase()}` : ""}{STATUS[t.status] ? ` · ${STATUS[t.status]}` : ""}</span>
                      </span>
                      <span className={`shrink-0 text-lg font-extrabold tabular-nums ${off ? "text-navy/40 line-through" : t.amount >= 0 ? "text-[#15803D]" : "text-[#B45309]"}`}>
                        {t.amount >= 0 ? "+" : "−"}{formatPrice(Math.abs(t.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <section id="compte" className="scroll-mt-24 rounded-3xl border-2 border-line bg-white p-4">
        <h2 className="text-lg font-extrabold text-ink">💳 Où je reçois mon argent</h2>
        <p className="mt-1 text-sm text-navy/75">{account ? `Mes retraits partent sur ${account}.` : "Indiquez votre numéro Wave ou Orange Money."}</p>
        <div className="mt-3"><LivreurWalletForm provider={acct?.walletProvider ?? null} number={acct?.walletNumber ?? null} channels={channels} /></div>
      </section>
    </div>
  );
}

function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <p className="mt-4 rounded-3xl bg-white p-6 text-center text-lg font-bold text-navy/75">
      <span className="block text-5xl" aria-hidden="true">{emoji}</span>
      {text}
    </p>
  );
}
