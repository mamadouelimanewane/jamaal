import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { setThreadBot } from "@/lib/actions/whatsapp-inbox";
import { canonicalizePhone } from "@/lib/phone";
import { phoneTail } from "@/lib/phone-match";
import { whatsappConfig } from "@/lib/whatsapp";
import { WhatsAppReplyForm } from "@/components/admin/WhatsAppReplyForm";

export const dynamic = "force-dynamic";

const WHO: Record<string, string> = { bot: "Assistant", conseiller: "Conseiller", suivi: "Suivi", relance: "Relance", avis: "Avis", campagne: "Campagne", kit: "Kit", livreur: "Livreur", team: "Équipe", reseller: "Revendeur", client: "Notification", test: "Test", resume: "Résumé" };
const ORDER_STATUS: Record<string, string> = { EN_ATTENTE: "En attente", CONFIRMEE: "Confirmée", EXPEDIEE: "Expédiée", LIVREE: "Livrée", ANNULEE: "Annulée" };

/** Âge d'une date (hors rendu React : fonction de module). */
const ageMs = (d: Date) => Date.now() - d.getTime();

type Row = { phone: string; name: string | null; lastMessageAt: Date; botPausedUntil: Date | null; body: string | null; direction: string | null; unread: bigint };

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ p?: string; q?: string }> }) {
  await requireAdmin("whatsapp", "read");
  const { p, q } = await searchParams;
  const search = (q ?? "").trim();
  const like = `%${search.replace(/[%_]/g, "")}%`;
  const threads = await prisma.$queryRaw<Row[]>`
    SELECT t.phone, t.name, t."lastMessageAt", t."botPausedUntil", m.body, m.direction,
      (SELECT count(*) FROM "WhatsAppMessage" u WHERE u."toNumber" = t.phone AND u.direction = 'IN' AND u."createdAt" > coalesce(t."lastReadAt", 'epoch'::timestamp)) AS unread
    FROM "WhatsAppThread" t
    LEFT JOIN LATERAL (SELECT body, direction FROM "WhatsAppMessage" w WHERE w."toNumber" = t.phone ORDER BY w."createdAt" DESC LIMIT 1) m ON true
    WHERE ${search ? like : "%"} = '%' OR t.phone LIKE ${like} OR coalesce(t.name, '') ILIKE ${like}
    ORDER BY t."lastMessageAt" DESC LIMIT 60`.catch(() => null);

  const phone = p ? canonicalizePhone(p) : threads?.[0]?.phone ?? "";
  const current = threads?.find((t) => t.phone === phone) ?? null;
  const [messages, thread] = phone
    ? await Promise.all([
        prisma.whatsAppMessage.findMany({ where: { toNumber: phone }, orderBy: { createdAt: "desc" }, take: 120 }),
        prisma.whatsAppThread.findUnique({ where: { phone } }),
      ])
    : [[], null];
  // Ouvrir la conversation la marque comme lue.
  if (phone && thread) await prisma.whatsAppThread.update({ where: { phone }, data: { lastReadAt: new Date() } }).catch(() => {});
  const tail = phoneTail(phone);
  const orders = tail
    ? await prisma.$queryRaw<{ id: string; createdAt: Date; status: string; paymentStatus: string; total: number; channel: string }[]>`
        SELECT id, "createdAt", status::text AS status, "paymentStatus"::text AS "paymentStatus", total, channel FROM "Order"
        WHERE right(regexp_replace(coalesce("customerPhone", ''), '[^0-9]', '', 'g'), 9) = ${tail} ORDER BY "createdAt" DESC LIMIT 8`
    : [];
  const customer = tail ? (await prisma.$queryRaw<{ id: string; name: string; whatsappOptOut: boolean }[]>`SELECT id, name, "whatsappOptOut" FROM "Customer" WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`)[0] : undefined;
  const lastIn = messages.find((m) => m.direction === "IN");
  const windowOpen = !!lastIn && ageMs(lastIn.createdAt) < 86_400_000;
  const paused = thread?.botPausedUntil && thread.botPausedUntil > new Date() ? thread.botPausedUntil : null;
  const cfg = whatsappConfig();

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Conversations WhatsApp</h1>
          <p className="mt-1 text-sm text-navy/75">Tous les échanges avec les clients, revendeurs et livreurs. Répondez vous-même : l&apos;assistant se met en pause sur la conversation.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/whatsapp/campagnes" className="rounded-full border border-line px-4 py-2 font-semibold text-navy hover:bg-cream">Campagnes</Link>
          <Link href="/admin/journal-whatsapp" className="rounded-full border border-line px-4 py-2 font-semibold text-navy hover:bg-cream">Journal</Link>
        </div>
      </div>
      {!cfg.active && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">Mode simulation : WhatsApp n&apos;est pas encore branché (variables Meta à renseigner dans Vercel). Les messages sont enregistrés mais pas envoyés.</p>}

      {threads === null ? (
        <p className="mt-6 rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/70">La boîte de réception sera disponible après la mise à jour de la base (migration 21).</p>
      ) : (
        <div className="mt-6 grid min-h-[70vh] overflow-hidden rounded-2xl border border-line bg-white lg:grid-cols-[20rem_1fr_17rem]">
          <aside className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
            <form className="border-b border-line p-3">
              <input name="q" defaultValue={search} placeholder="Rechercher (nom, numéro)" className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ia" />
            </form>
            <ul className="max-h-[70vh] overflow-y-auto">
              {threads.map((t) => (
                <li key={t.phone}>
                  <Link href={`/admin/whatsapp/conversations?p=${t.phone}${search ? `&q=${encodeURIComponent(search)}` : ""}`} className={`block border-b border-line/60 px-4 py-3 hover:bg-cream ${t.phone === phone ? "bg-ia-light/40" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-navy">{t.name || `+${t.phone}`}</span>
                      {Number(t.unread) > 0 && <span className="rounded-full bg-[#25D366] px-2 py-0.5 text-[10px] font-bold text-white">{Number(t.unread)}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-navy/60">{t.direction === "OUT" ? "Vous : " : ""}{t.body ?? ""}</p>
                    <p className="mt-0.5 text-[10px] text-navy/45">{t.lastMessageAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}{t.botPausedUntil && t.botPausedUntil > new Date() ? " · assistant en pause" : ""}</p>
                  </Link>
                </li>
              ))}
              {threads.length === 0 && <li className="p-6 text-center text-sm text-navy/60">Aucune conversation pour le moment.</li>}
            </ul>
          </aside>

          <section className="flex min-w-0 flex-col">
            {phone ? (
              <>
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy">{current?.name || customer?.name || `+${phone}`}</p>
                    <p className="text-xs text-navy/60">+{phone}{customer?.whatsappOptOut ? " · a répondu STOP" : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    {paused ? (
                      <form action={setThreadBot.bind(null, phone, 0)}><button className="rounded-full bg-ia px-3 py-1.5 text-xs font-semibold text-white hover:bg-ia-dark">Relancer l&apos;assistant</button></form>
                    ) : (
                      <form action={setThreadBot.bind(null, phone, 24)}><button className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream">Pause assistant 24 h</button></form>
                    )}
                    <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#1f9d55]">Ouvrir WhatsApp</a>
                  </div>
                </header>
                {paused && <p className="bg-amber-50 px-4 py-1.5 text-xs text-amber-800">Assistant en pause jusqu&apos;à {paused.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} : un conseiller répond.</p>}
                <div className="flex max-h-[58vh] flex-1 flex-col-reverse gap-2 overflow-y-auto bg-[#efeae2] p-4">
                  {messages.map((m) => (
                    <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.direction === "IN" ? "self-start bg-white text-navy" : "self-end bg-[#d9fdd3] text-navy"}`}>
                      {m.direction === "OUT" && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ia-dark">{WHO[m.kind] ?? m.kind}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-right text-[10px] text-navy/45">{m.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}{m.direction === "OUT" ? ` · ${m.status}` : ""}</p>
                      {m.error && <p className="text-[10px] text-rose-dark">{m.error}</p>}
                    </div>
                  ))}
                </div>
                <WhatsAppReplyForm phone={phone} windowOpen={windowOpen} />
              </>
            ) : (
              <p className="m-auto p-8 text-sm text-navy/60">Choisissez une conversation.</p>
            )}
          </section>

          <aside className="min-w-0 border-t border-line p-4 lg:border-l lg:border-t-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/60">Commandes du client</h2>
            {orders.length ? (
              <ul className="mt-3 space-y-2">
                {orders.map((o) => (
                  <li key={o.id} className="rounded-xl border border-line p-3 text-xs">
                    <Link href={`/admin/commandes/${o.id}`} className="font-semibold text-navy underline">{o.id.slice(-8).toUpperCase()}</Link>
                    <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[10px]">{o.channel === "WHATSAPP" ? "WhatsApp" : o.channel === "REVENDEUR" ? "Revendeur" : "Site"}</span>
                    <p className="mt-1 text-navy/70">{o.createdAt.toLocaleDateString("fr-FR")} · {o.total.toLocaleString("fr-FR")} FCFA</p>
                    <p className="text-navy/70">{ORDER_STATUS[o.status] ?? o.status} · {o.paymentStatus === "PAYE" ? "payée" : "non payée"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-navy/60">Aucune commande avec ce numéro.</p>
            )}
            {customer && <Link href={`/admin/clients/${customer.id}`} className="mt-4 inline-block text-xs font-semibold text-ia-dark underline">Fiche client</Link>}
          </aside>
        </div>
      )}
    </div>
  );
}
