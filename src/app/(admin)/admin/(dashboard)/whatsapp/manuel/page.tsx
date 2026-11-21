import Link from "next/link";
import { Cloud, Download, FileText, MessageSquare, ShieldCheck, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import { WhatsAppSubNav } from "@/components/admin/WhatsAppSubNav";

export const dynamic = "force-dynamic";

const COMPARISON_ROWS = [
  {
    criterion: "Expéditeur affiché chez le client",
    cloud: "Compte officiel JAMAAL Luxury (+221 71 180 09 09)",
    p2p: "Numéro WhatsApp personnel du Parrain / Consultant (ou de l'admin)",
  },
  {
    criterion: "Mode d'envoi",
    cloud: "Envoi direct en 1 clic depuis l'interface JAMAAL ou automatique en arrière-plan",
    p2p: "Ouvre l'application WhatsApp sur Mobile ou PC avec le texte pré-rempli (wa.me)",
  },
  {
    criterion: "Règle Meta des 24 heures",
    cloud: "OUI : texte libre autorisé uniquement si le client a écrit depuis < 24 h. Hors 24 h : Modèle approuvé Meta obligatoire",
    p2p: "NON : aucune limite de 24 h, message 100 % libre à tout moment",
  },
  {
    criterion: "Modèles utilisables",
    cloud: "Uniquement les Modèles approuvés par Meta (APPROVED : test_lancement_produit, test_jamaal, test_appointement, test_san_param)",
    p2p: "Textes rapides internes JAMAAL + tout texte libre personnalisé",
  },
  {
    criterion: "Qui peut l'utiliser hors fenêtre 24 h ?",
    cloud: "Strictement réservé aux Administrateurs (modèles Cloud & campagnes)",
    p2p: "Parrains, Consultants et Administrateurs",
  },
  {
    criterion: "Traçabilité",
    cloud: "Journalisé automatiquement dans JAMAAL, KwingoChat et le Journal WhatsApp (ENVOYE, LIVRE, LU, ECHEC)",
    p2p: "Conversation poursuivie directement sur le WhatsApp de l'appareil du conseiller",
  },
];

const FLOW_ROWS = [
  {
    flow: "1. Messages entrants des clients au +221 71 180 09 09",
    channel: "API Cloud",
    badge: "cloud",
    rule: "Synchronisés depuis KwingoChat et routés automatiquement vers l'inbox du parrain/consultant du client (ROUTAGE_CLIENT, LIEN_BOUTIQUE, CAMPAGNE) ou maintenus dans Non assignés (unassigned).",
  },
  {
    flow: "2. Formulaire « Contact » du site public (/contact)",
    channel: "API Cloud",
    badge: "cloud",
    rule: "Crée ou alimente immédiatement une conversation dans la Messagerie WhatsApp JAMAAL, la rattache au consultant du client et alerte l'équipe par WhatsApp Cloud API.",
  },
  {
    flow: "3. Réponse à un client dans la fenêtre < 24 h",
    channel: "API Cloud ou P2P",
    badge: "both",
    rule: "Double choix dans l'inbox : bouton vert « Répondre ici (API Cloud · 24h) » ou bouton « Répondre avec mon WhatsApp personnel (Mobile / PC) ».",
  },
  {
    flow: "4. Réponse à un client hors fenêtre > 24 h",
    channel: "P2P (Consultant) / API Cloud (Admin)",
    badge: "both",
    rule: "Parrain / Consultant : réponse uniquement via son WhatsApp personnel (P2P). Administrateur : envoi possible par Modèle approuvé Meta via l'API Cloud ou en P2P.",
  },
  {
    flow: "5. Campagnes WhatsApp & Import Excel (/admin/whatsapp/campagnes)",
    channel: "API Cloud (Admin)",
    badge: "cloud",
    rule: "Choix obligatoire d'un modèle approuvé Meta + ciblage par filtres base JAMAAL et/ou fichier Excel (.xlsx, .csv). Les retours clients sont auto-assignés à leur consultant.",
  },
  {
    flow: "6. Annonces générales aux consultants (/admin/annonces)",
    channel: "API Cloud + Interne",
    badge: "cloud",
    rule: "Publiées dans « Ma communication » + cloche interne + diffusées sur WhatsApp via l'API Cloud JAMAAL Luxury.",
  },
  {
    flow: "7. Annonces ciblées par statistiques (/admin/boutiques-stats)",
    channel: "Interne + WhatsApp P2P",
    badge: "p2p",
    rule: "Message personnalisé ({prenom}, {ventes}, {visiteurs}) publié dans l'espace revendeur + boutons d'ouverture directe WhatsApp P2P par revendeur.",
  },
  {
    flow: "8. Notifications automatiques (Commandes, Livreur, Relances, Kit du matin)",
    channel: "API Cloud",
    badge: "cloud",
    rule: "Envoyées automatiquement par la passerelle API Cloud JAMAAL Luxury (avec repli sur un modèle Meta approuvé si la fenêtre 24 h est fermée).",
  },
  {
    flow: "9. Boutons « Commander sur WhatsApp » sur le site",
    channel: "P2P → API Cloud",
    badge: "p2p",
    rule: "Le client ouvre son WhatsApp vers +221 71 180 09 09 : dès qu'il envoie son message, une fenêtre gratuite de 24 h s'ouvre côté API Cloud.",
  },
];

export default async function ManuelWhatsAppPage() {
  await requireAdmin("whatsapp", "read");
  const kwingoConn = await getKwingoConnection();

  return (
    <div className="max-w-6xl space-y-6">
      <WhatsAppSubNav connected={kwingoConn.connected} />

      {/* En-tête + Bouton de téléchargement Word (.docx) */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy">
            Documentation officielle JAMAAL Luxury
          </span>
          <h1 className="mt-1.5 font-serif-display text-2xl font-semibold text-navy">
            Manuel Messagerie & Notifications WhatsApp
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Distinction opérationnelle entre la <strong>Voie 1 : API Cloud Officielle (+221 71 180 09 09 · Meta / KwingoChat)</strong> et la <strong>Voie 2 : WhatsApp P2P Personnel (Mobile / PC)</strong>.
          </p>
        </div>

        <a
          href="/api/export/manuel-whatsapp-docx"
          className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-navy/90"
        >
          <Download size={15} />
          <span>Télécharger la version Word (.docx)</span>
        </a>
      </div>

      {/* Les 2 voies côte à côte */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <Cloud size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1f9d55]">
                Voie 1 · Automatisée & Centralisée
              </span>
              <h2 className="font-serif-display text-lg font-semibold text-navy">
                API Cloud Officielle (+221 71 180 09 09)
              </h2>
            </div>
          </div>
          <ul className="mt-3.5 space-y-2 text-xs leading-relaxed text-navy/85">
            <li>
              • <strong>Expéditeur unique</strong> : compte WhatsApp Business officiel <strong>JAMAAL Luxury</strong> connecté à KwingoChat.
            </li>
            <li>
              • <strong>Dans la fenêtre de 24 h</strong> (après un message entrant du client) : réponse directe en texte libre ou via un modèle approuvé par Meta.
            </li>
            <li>
              • <strong>Hors fenêtre de 24 h</strong> : Meta exige obligatoirement un <strong>Modèle approuvé par Meta</strong> (envoi réservé aux Administrateurs).
            </li>
            <li>
              • <strong>Routage intelligent</strong> : chaque retour de campagne ou message spontané est assigné automatiquement au parrain/consultant du client (ou placé dans <code>unassigned</code>).
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
              <Smartphone size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy/65">
                Voie 2 · Relation Directe Conseiller
              </span>
              <h2 className="font-serif-display text-lg font-semibold text-navy">
                WhatsApp P2P Personnel (Mobile / PC)
              </h2>
            </div>
          </div>
          <ul className="mt-3.5 space-y-2 text-xs leading-relaxed text-navy/85">
            <li>
              • <strong>Expéditeur personnel</strong> : ouvre l&apos;application WhatsApp du parrain/consultant (ou de l&apos;admin) avec le numéro du client et le texte pré-rempli.
            </li>
            <li>
              • <strong>Aucune limite de 24 heures</strong> : permet de relancer ou répondre à un client même plusieurs jours ou semaines après son dernier message.
            </li>
            <li>
              • <strong>Textes rapides internes JAMAAL</strong> : tous les textes rapides internes (marqués <em>Non utilisables par API Cloud</em>) sont conçus pour cette voie P2P.
            </li>
            <li>
              • <strong>Idéal pour les parrains hors 24 h</strong> : garantit qu&apos;un consultant peut toujours joindre son client sans dépendre d&apos;un template Meta.
            </li>
          </ul>
        </div>
      </div>

      {/* Tableau comparatif détaillé */}
      <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-2xs">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-serif-display text-base font-semibold text-navy">
            1. Tableau comparatif : Voie API Cloud vs Voie WhatsApp P2P
          </h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-cream text-[11px] uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Critère</th>
              <th className="px-4 py-3 text-[#1f9d55]">☁️ Voie 1 : API Cloud (+221 71 180 09 09)</th>
              <th className="px-4 py-3 text-navy">📱 Voie 2 : WhatsApp P2P (Mobile / PC)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {COMPARISON_ROWS.map((r) => (
              <tr key={r.criterion} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-semibold text-navy">{r.criterion}</td>
                <td className="px-4 py-3 text-navy/85">{r.cloud}</td>
                <td className="px-4 py-3 text-navy/85">{r.p2p}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Matrice des 9 flux */}
      <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-2xs">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-serif-display text-base font-semibold text-navy">
            2. Matrice complète des flux et notifications WhatsApp
          </h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-cream text-[11px] uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Flux / Fonctionnalité</th>
              <th className="px-4 py-3">Voie utilisée</th>
              <th className="px-4 py-3">Fonctionnement & Règles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {FLOW_ROWS.map((r) => (
              <tr key={r.flow} className="hover:bg-cream/30">
                <td className="px-4 py-3 font-semibold text-navy">{r.flow}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      r.badge === "cloud"
                        ? "bg-emerald-50 text-[#1f9d55] border border-emerald-200"
                        : r.badge === "p2p"
                          ? "bg-cream text-navy border border-line"
                          : "bg-blue-50 text-blue-800 border border-blue-200"
                    }`}
                  >
                    {r.channel}
                  </span>
                </td>
                <td className="px-4 py-3 leading-relaxed text-navy/80">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Rappel sur les modèles Meta vs Textes rapides internes */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-[#1f9d55]" />
            <h2 className="font-serif-display text-base font-semibold text-navy">
              3. Règle de sécurité : Modèles approuvés Meta vs Textes rapides internes JAMAAL
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/whatsapp/conversations"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/60 px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
            >
              <MessageSquare size={13} /> Ouvrir la Messagerie
            </Link>
            <a
              href="/api/export/manuel-whatsapp-docx"
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
            >
              <FileText size={13} /> Télécharger en Word (.docx)
            </a>
          </div>
        </div>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-emerald-950">
            <p className="font-bold text-[#1f9d55]">✓ Modèles approuvés par Meta (Voie API Cloud)</p>
            <p className="mt-1 leading-relaxed">
              Synchronisés automatiquement via <code>GET /api/v1/templates/sync</code> (ex. <code>test_lancement_produit</code>, <code>test_jamaal</code>, <code>test_appointement</code>, <code>test_san_param</code>). Ils sont envoyés avec leur code langue exact pour éviter toute erreur <code>#132001</code>.
            </p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-amber-950">
            <p className="font-bold text-amber-900">⚠️ Textes rapides internes JAMAAL (Voie WhatsApp P2P)</p>
            <p className="mt-1 leading-relaxed">
              Disponibles dans le tiroir <em>Modèles de réponses rapides</em> pour préparer une réponse rapide, mais signalés comme <strong>Non utilisables par API Cloud</strong>. Lorsqu&apos;un texte interne est choisi, le bouton API Cloud est désactivé au profit du bouton <strong>« Répondre avec mon WhatsApp personnel (Mobile / PC) »</strong>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
