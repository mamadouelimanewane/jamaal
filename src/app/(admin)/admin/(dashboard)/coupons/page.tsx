import { requireAdminPage } from "@/lib/admin-page-guard";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { deleteCoupon } from "@/lib/actions/coupons";
import { formatPrice } from "@/lib/currency";
import { getSiteUrl } from "@/lib/site-url";
import { audienceLabel, couponLink, couponMessage } from "@/lib/coupon-audience";
import { shopWhatsAppLink } from "@/lib/shop/consultant-shop";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

/** Codes promo : créés par le système, ciblés (tous les clients, un client, un vendeur, tous les vendeurs), partagés par lien ou WhatsApp. */
export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
  await requireAdminPage("marketing");
  const { nouveau } = await searchParams;
  const [coupons, origin] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { orders: true } } } }),
    getSiteUrl().catch(() => "https://www.jamaal.sn"),
  ]);
  const sellers = new Map(
    (await prisma.consultant.findMany({ where: { id: { in: coupons.map((c) => c.targetConsultantId).filter((x): x is string => !!x) } }, select: { id: true, name: true, slug: true, whatsapp: true } })).map((c) => [c.id, c])
  );
  const now = new Date();
  const isValid = (c: (typeof coupons)[number]) => c.active && (!c.expiresAt || c.expiresAt > now) && (c.usageLimit === null || c.usedCount < c.usageLimit);
  const share = (c: (typeof coupons)[number]) => {
    const seller = c.targetConsultantId ? sellers.get(c.targetConsultantId) : undefined;
    const link = couponLink(origin, c.code, seller?.slug);
    const name = c.audience === "CLIENT" ? c.targetName : c.audience === "VENDEUR" ? seller?.name : null;
    const message = couponMessage({ audience: c.audience, name, code: c.code, kind: c.type, value: c.value, expiresAt: c.expiresAt, link });
    const phone = c.audience === "CLIENT" ? c.targetPhone : c.audience === "VENDEUR" ? seller?.whatsapp : null;
    const wa = (phone && shopWhatsAppLink(phone, message)) || `https://wa.me/?text=${encodeURIComponent(message)}`;
    const who = c.audience === "CLIENT" ? `${c.targetName ?? "Client"} · ${c.targetPhone ?? ""}` : c.audience === "VENDEUR" ? seller?.name ?? "Vendeur" : audienceLabel(c.audience);
    return { link, message, wa, who, direct: !!phone };
  };
  const created = nouveau ? coupons.find((c) => c.id === nouveau) : undefined;
  const activeCount = coupons.filter(isValid).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Acquisition & fidélité</p>
          <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Codes promotionnels</h1>
          <p className="mt-1 text-sm text-navy/75">{activeCount} codes actifs · {coupons.length} au total. Le code est créé par le système ; copiez le lien ou envoyez-le sur WhatsApp.</p>
        </div>
        <Link href="/admin/coupons/nouveau" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">+ Créer un code</Link>
      </div>

      {created && (() => {
        const s = share(created);
        return (
          <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-950">Code créé : <span className="tracking-wider">{created.code}</span> · {s.who}</p>
            <p className="mt-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-navy">{s.link}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 font-sans text-xs text-navy/85">{s.message}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={s.wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-[#128C4B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F7A41]">{s.direct ? `Envoyer sur WhatsApp à ${s.who.split(" · ")[0]}` : "Envoyer sur WhatsApp"}</a>
              <CopyButton text={s.message} label="Copier le message" />
              <CopyButton text={s.link} label="Copier le lien" />
            </div>
          </section>
        );
      })()}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Pour qui</th><th className="px-4 py-3">Avantage</th><th className="px-4 py-3">Utilisations</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Partager</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const valid = isValid(c);
              const s = share(c);
              return (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-semibold tracking-wider text-navy">{c.code}{c.note && <span className="block text-[11px] font-normal tracking-normal text-navy/60">{c.note}</span>}</td>
                  <td className="px-4 py-3 text-navy/85">{s.who}</td>
                  <td className="px-4 py-3">{c.type === "POURCENTAGE" ? `${c.value} %` : formatPrice(c.value)}</td>
                  <td className="px-4 py-3">{c.usedCount} / {c.usageLimit ?? "∞"} <span className="text-navy/70">({c._count.orders} cmd)</span></td>
                  <td className="px-4 py-3">{c.expiresAt?.toLocaleDateString("fr-FR") ?? "Sans limite"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${valid ? "bg-emerald-100 text-emerald-800" : "bg-navy/5 text-navy/75"}`}>{valid ? "Actif" : "Inactif / expiré"}</span></td>
                  <td className="px-4 py-3">
                    {valid ? (
                      <div className="flex flex-wrap gap-1.5">
                        <a href={s.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-[#128C4B] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0F7A41]">WhatsApp</a>
                        <CopyButton text={s.link} label="Lien" />
                        <CopyButton text={s.message} label="Message" />
                      </div>
                    ) : <span className="text-xs text-navy/50">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link className="mr-3 text-xs font-semibold text-navy hover:underline" href={`/admin/coupons/${c.id}/modifier`}>Modifier</Link>
                    <form action={deleteCoupon.bind(null, c.id)} className="inline"><button className="text-xs font-semibold text-rose-dark hover:underline">Désactiver</button></form>
                  </td>
                </tr>
              );
            })}
            {!coupons.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-navy/70">Aucun code promo pour le moment.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
