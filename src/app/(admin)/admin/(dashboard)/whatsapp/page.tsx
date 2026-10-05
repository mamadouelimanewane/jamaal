import { Download, MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { AWAY, GREETING, QUICK_REPLIES, SETUP_STEPS } from "@/data/whatsapp-business";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

export default async function CentreWhatsAppPage() {
  await requireAdmin();

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Centre WhatsApp</h1>
      <p className="mt-1 text-sm text-navy/60">
        Tout pour vendre depuis WhatsApp : vos numéros, le catalogue à importer, les réponses rapides et le guide de configuration de l&apos;application WhatsApp Business.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-serif-display text-lg font-semibold text-navy"><MessageCircle size={18} /> Vos numéros</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {WHATSAPP_CONTACTS.map((c) => (
            <a key={c.number} href={whatsappLink(c.number)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              {c.display}
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-navy/50">Ces deux numéros reçoivent les messages du site (bouton vert, contact, candidatures).</p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Catalogue pour WhatsApp Business</h2>
        <p className="mt-1 text-sm text-navy/60">
          Fichier CSV de tous vos produits (nom, prix en FCFA, photo, lien), au format attendu par le Gestionnaire de commerce de Meta, pour alimenter le catalogue de votre application WhatsApp Business.
        </p>
        <a href="/api/export/catalogue-whatsapp" className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
          <Download size={15} /> Télécharger le catalogue (CSV)
        </a>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Configurer l&apos;application WhatsApp Business</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-navy/75">
          {SETUP_STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Message d&apos;accueil et d&apos;absence</h2>
        <div className="mt-3 flex flex-col gap-3">
          {[["Message d'accueil", GREETING], ["Message d'absence", AWAY]].map(([label, text]) => (
            <div key={label} className="rounded-xl border border-line bg-cream p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">{label}</p>
                <CopyButton text={text} />
              </div>
              <p className="mt-1.5 text-sm text-navy/80">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Réponses rapides</h2>
        <p className="mt-1 text-sm text-navy/60">Enregistrez chaque texte avec son raccourci : en tapant « / » dans une conversation, WhatsApp propose la réponse.</p>
        <div className="mt-3 flex flex-col gap-3">
          {QUICK_REPLIES.map((r) => (
            <div key={r.shortcut} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy"><span className="font-mono text-rose-dark">{r.shortcut}</span> · {r.label}</p>
                <CopyButton text={r.text} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
