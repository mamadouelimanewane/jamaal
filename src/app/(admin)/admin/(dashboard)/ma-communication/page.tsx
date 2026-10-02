import Link from "next/link";
import { Bell, Megaphone, MessageCircle, Pin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/\D/g, "");

export default async function MaCommunicationPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;

  const [announcements, notifications] = await Promise.all([
    // Tolère l'absence de la table tant que la migration « Announcement » n'est pas appliquée.
    prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 20 }).catch(() => []),
    prisma.notification.findMany({ where: { userId: me.userId }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const hello = `Bonjour JAMAAL, je suis ${me.name} (revendeur·se, ${me.city}). `;

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Ma communication</h1>
      <p className="mt-1 text-sm text-navy/60">Les annonces de l&apos;équipe JAMAAL, vos notifications et les moyens de nous joindre.</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Megaphone size={18} /> Annonces de l&apos;équipe</h2>
          <div className="mt-3 flex flex-col gap-3">
            {announcements.map((a) => (
              <article key={a.id} className={`rounded-xl border p-4 ${a.pinned ? "border-rose bg-rose/5" : "border-line"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-navy">{a.title}</h3>
                  {a.pinned && <Pin size={14} className="mt-1 shrink-0 text-rose-dark" aria-label="Épinglée" />}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy/75">{a.body}</p>
                <p className="mt-2 text-xs text-navy/40">{a.createdAt.toLocaleDateString("fr-FR")}</p>
              </article>
            ))}
            {announcements.length === 0 && <p className="py-6 text-center text-sm text-navy/50">Aucune annonce pour le moment.</p>}
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><MessageCircle size={18} /> Écrire à JAMAAL</h2>
            <p className="mt-1 text-sm text-navy/60">Une question, une commande à suivre, un code promo à demander ?</p>
            <div className="mt-3 flex flex-col gap-2">
              {WHATSAPP_CONTACTS.map((c) => (
                <a key={c.number} href={whatsappLink(c.number, hello)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90">
                  WhatsApp {c.display}
                </a>
              ))}
            </div>
          </section>

          {me.sponsor && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-serif-display text-lg font-semibold text-navy">Mon parrain</h2>
              <p className="mt-1 text-sm text-navy/70">{me.sponsor.name} · {me.sponsor.city}</p>
              <a
                href={me.sponsor.whatsapp.startsWith("http") ? me.sponsor.whatsapp : `https://wa.me/${digits(me.sponsor.whatsapp)}?text=${encodeURIComponent(`Bonjour ${me.sponsor.name}, c'est ${me.name}, ta filleule/ton filleul JAMAAL. `)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
              >
                Le/la contacter
              </a>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><Bell size={18} /> Dernières notifications</h2>
            <ul className="mt-3 divide-y divide-line text-sm">
              {notifications.map((n) => (
                <li key={n.id} className="py-2">
                  <p className={`text-navy ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                  <p className="text-xs text-navy/50">{n.message.slice(0, 90)}</p>
                </li>
              ))}
              {notifications.length === 0 && <li className="py-3 text-center text-navy/50">Aucune notification.</li>}
            </ul>
            <Link href="/admin/notifications" className="mt-3 inline-block text-xs font-semibold text-rose-dark hover:underline">Toutes mes notifications →</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
