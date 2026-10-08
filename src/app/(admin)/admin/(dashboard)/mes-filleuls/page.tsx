import { MessageCircle, UserPlus, Users } from "lucide-react";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getReseller, resellerLinks, startOfMonth } from "@/lib/reseller";
import { getBusinessModel } from "@/lib/business-model-store";
import { sponsorRatesFor } from "@/lib/business-model";
import { COMMISSIONABLE_ORDER } from "@/lib/commission";
import { getNetworkDepth, titleForDepth } from "@/lib/network";
import { NetworkTitleBadge } from "@/components/admin/NetworkTitleBadge";
import { StatCard } from "@/components/admin/StatCard";
import { CopyButton } from "@/components/admin/CopyButton";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/\D/g, "");

export default async function MesFilleulsPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const since = startOfMonth();
  const links = await resellerLinks(me.slug);

  const [l1, model, depth] = await Promise.all([
    prisma.consultant.findMany({
      where: { sponsorId: me.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, city: true, whatsapp: true, active: true, createdAt: true, _count: { select: { sponsored: true } } },
    }),
    getBusinessModel(),
    getNetworkDepth(me.id),
  ]);
  const myTitle = titleForDepth(depth);
  const level1Title = titleForDepth(depth + 1);
  const level2Title = titleForDepth(depth + 2);
  // 6 % si je suis un parrain sans parrain au-dessus, 3 % sinon (+ 3 % sur le niveau 2).
  const { level1: rate1, level2: rate2 } = sponsorRatesFor(!!me.sponsorId, model);
  const ids = l1.map((c) => c.id);

  const [monthly, lifetime, applications, bonuses] = await Promise.all([
    ids.length
      ? prisma.order.groupBy({ by: ["consultantId"], where: { ...COMMISSIONABLE_ORDER, consultantId: { in: ids }, createdAt: { gte: since } }, _sum: { total: true, deliveryFee: true }, _count: { _all: true } })
      : [],
    ids.length
      ? prisma.order.groupBy({ by: ["consultantId"], where: { ...COMMISSIONABLE_ORDER, consultantId: { in: ids } }, _sum: { total: true, deliveryFee: true } })
      : [],
    me.slug
      ? prisma.consultantApplication.findMany({ where: { sponsorCode: me.slug }, orderBy: { createdAt: "desc" }, take: 20 })
      : [],
    prisma.fastStartBonus.findMany({ where: { sponsorId: me.id }, include: { sponsoree: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const m = new Map(monthly.map((r) => [r.consultantId, { ca: (r._sum.total ?? 0) - (r._sum.deliveryFee ?? 0), n: r._count._all }]));
  const l = new Map(lifetime.map((r) => [r.consultantId, (r._sum.total ?? 0) - (r._sum.deliveryFee ?? 0)]));
  const teamMonth = [...m.values()].reduce((s, v) => s + v.ca, 0);
  const l2Count = l1.reduce((s, c) => s + c._count.sponsored, 0);
  const pending = applications.filter((a) => a.status === "NOUVELLE").length;
  const inviteMsg = `Bonjour ! Je suis consultant·e JAMAAL, représentant exclusif de Chogan au Sénégal. Tu veux gagner de l'argent en vendant parfums, soins et produits maison ? Postule avec mon lien : ${links.recruit ?? ""}`;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes filleuls</h1>
        <NetworkTitleBadge title={myTitle} />
        <span className="ml-auto"><LiveRefresh /></span>
      </div>
      <p className="mt-1 text-sm text-navy/75">
        Vous êtes <strong>{myTitle}</strong>. Vos filleuls directs sont vos <strong>{level1Title}s</strong> : vous touchez {rate1} % sur leurs ventes encaissées.
        {" "}Sur les ventes de leurs propres filleuls ({level2Title}s), vous touchez {rate2} %.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Mes ${level1Title}s`} value={model.maxDirectRecruits > 0 ? `${l1.length} / ${model.maxDirectRecruits}` : l1.length} icon={Users} color="navy" />
        <StatCard label={`Leurs filleuls (${level2Title}s)`} value={l2Count} icon={Users} color="purple" />
        <StatCard label="CA équipe ce mois-ci" value={formatPrice(teamMonth)} icon={Users} color="emerald" />
        <StatCard label="Candidatures en attente" value={pending} icon={UserPlus} color="amber" />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Recruter un·e filleul·e</h2>
        {links.recruit ? (
          <>
            <p className="mt-1 text-sm text-navy/75">Votre lien d&apos;invitation : la candidature est automatiquement rattachée à vous.</p>
            <input readOnly value={links.recruit} className="mt-3 w-full rounded-xl border border-line bg-cream px-3 py-2 text-xs" />
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={links.recruit} label="Copier le lien" />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(inviteMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <MessageCircle size={13} /> Inviter sur WhatsApp
              </a>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-navy/75">Votre lien n&apos;est pas encore configuré : demandez à l&apos;équipe JAMAAL de renseigner votre identifiant (slug).</p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Filleul·e</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Ventes ce mois</th>
              <th className="px-4 py-3 text-right">CA du mois</th>
              <th className="px-4 py-3 text-right">Votre gain ({rate1} %)</th>
              <th className="px-4 py-3 text-right">CA total</th>
              <th className="px-4 py-3">Ses filleuls</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {l1.map((c) => {
              const mm = m.get(c.id);
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{c.name}</p>
                    <p className="text-xs text-navy/70">Depuis le {c.createdAt.toLocaleDateString("fr-FR")}{!c.active && " · inactif"}</p>
                  </td>
                  <td className="px-4 py-3">{c.city}</td>
                  <td className="px-4 py-3">{mm?.n ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatPrice(mm?.ca ?? 0)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">{formatPrice(Math.round(((mm?.ca ?? 0) * rate1) / 100))}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatPrice(l.get(c.id) ?? 0)}</td>
                  <td className="px-4 py-3">{c._count.sponsored}</td>
                  <td className="px-4 py-3 text-right">
                    {c.whatsapp && (
                      <a
                        href={c.whatsapp.startsWith("http") ? c.whatsapp : `https://wa.me/${digits(c.whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-rose-dark hover:underline"
                      >
                        Contacter
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {l1.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-navy/70">Aucun filleul pour le moment. Partagez votre lien d&apos;invitation !</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {applications.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Candidatures reçues via votre lien</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {applications.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-navy">{a.name} <span className="text-xs text-navy/70">· {a.city} · {a.createdAt.toLocaleDateString("fr-FR")}</span></span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.status === "ACCEPTEE" ? "bg-emerald-100 text-emerald-800" : a.status === "REFUSEE" ? "bg-navy/10 text-navy/75" : "bg-amber-100 text-amber-800"}`}>
                  {a.status === "ACCEPTEE" ? "Acceptée" : a.status === "REFUSEE" ? "Refusée" : "En étude"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bonuses.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Bonus de démarrage rapide</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {bonuses.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className="text-navy">{b.sponsoree.name}</span>
                <span className="font-semibold text-navy">{formatPrice(b.amount)} <span className="ml-2 text-xs font-normal text-navy/70">{b.status === "PENDING" ? "en attente" : "versé"}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
