import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { ContactMessageActions } from "@/components/admin/ContactMessageActions";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireAdmin();
  const messages = await prisma.contactMessage.findMany({ orderBy: [{ read: "asc" }, { createdAt: "desc" }], take: 200 });
  const unread = messages.filter((m) => !m.read).length;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Messages de contact ({unread} non lu{unread > 1 ? "s" : ""})</h1>
      <p className="mt-1 text-sm text-navy/60">Messages envoyés depuis le formulaire de la page Contact du site.</p>

      <div className="mt-6 flex flex-col gap-3">
        {messages.map((m) => (
          <article key={m.id} className={`rounded-2xl border bg-white p-5 ${m.read ? "border-line" : "border-rose"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-navy">
                  {m.name} {!m.read && <span className="ml-2 rounded-full bg-rose/20 px-2 py-0.5 text-xs font-semibold text-rose-dark">Nouveau</span>}
                </p>
                <a href={`mailto:${m.email}`} className="text-xs text-rose-dark hover:underline">{m.email}</a>
                <p className="text-xs text-navy/50">{m.createdAt.toLocaleString("fr-FR")}</p>
              </div>
              <ContactMessageActions id={m.id} read={m.read} />
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-navy/80">{m.message}</p>
          </article>
        ))}
        {messages.length === 0 && <p className="rounded-2xl border border-line bg-white p-10 text-center text-navy/50">Aucun message pour le moment.</p>}
      </div>
    </div>
  );
}
