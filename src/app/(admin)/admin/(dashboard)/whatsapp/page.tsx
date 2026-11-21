import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, Megaphone, MessageSquare, ShieldCheck, Sparkles, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { whatsappConfig } from "@/lib/whatsapp";
import { daysAgo } from "@/lib/whatsapp/diagnose";
import { fetchKwingoMetaTemplates, getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import { getCustomMessages, MESSAGE_KEYS, WA_MESSAGES } from "@/lib/whatsapp/message-templates";
import { WhatsAppMessagesEditor } from "@/components/admin/WhatsAppMessagesEditor";
import { WhatsAppSubNav } from "@/components/admin/WhatsAppSubNav";

export const dynamic = "force-dynamic";

export default async function CentreEtModelesWhatsAppPage() {
  await requireAdmin("whatsapp", "read");
  const kwingoContact = WHATSAPP_CONTACTS[0];
  const since7d = daysAgo(7);

  const [kwingoConn, metaTemplates, totalThreads, unassignedThreads, sent7d, custom] = await Promise.all([
    getKwingoConnection(),
    fetchKwingoMetaTemplates().catch(() => []),
    prisma.whatsAppThread.count().catch(() => 0),
    prisma.whatsAppThread.count({ where: { consultantId: null } }).catch(() => 0),
    prisma.whatsAppMessage
      .count({
        where: {
          direction: "OUT",
          status: { in: ["ENVOYE", "LIVRE", "LU"] },
          createdAt: { gte: since7d },
        },
      })
      .catch(() => 0),
    getCustomMessages(),
  ]);

  const cfg = whatsappConfig();
  const isConnected = kwingoConn.connected || cfg.active;

  return (
    <div className="max-w-6xl space-y-6">
      <WhatsAppSubNav connected={isConnected} unassignedCount={unassignedThreads} />

      {/* En-tête de la page Centre & Modèles */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Centre & Modèles WhatsApp JAMAAL
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Vue d&apos;ensemble de la passerelle <strong>{kwingoContact.display} ({kwingoContact.phone} · API Cloud)</strong>, répertoire des modèles approuvés par Meta et personnalisation des messages automatiques.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="/api/export/catalogue-whatsapp"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 font-semibold text-navy hover:bg-cream"
          >
            <Download size={14} /> Catalogue Produits CSV (Meta)
          </a>
          <Link
            href="/admin/whatsapp/conversations"
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 font-semibold text-white hover:bg-navy/90"
          >
            <MessageSquare size={14} /> Ouvrir la Messagerie ({totalThreads})
          </Link>
        </div>
      </div>

      {/* 4 cartes de synthèse claires et cliquables */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/whatsapp/conversations"
          className="group rounded-2xl border border-line bg-white p-4 shadow-2xs transition hover:border-navy"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-navy/65">
            <span>Conversations actives</span>
            <MessageSquare size={16} className="text-navy/70 group-hover:text-navy" />
          </div>
          <p className="mt-2 font-serif-display text-2xl font-semibold text-navy">{totalThreads}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ia-dark">
            Ouvrir la boîte de réception <ArrowRight size={12} />
          </p>
        </Link>

        <Link
          href="/admin/whatsapp/conversations?manager=unassigned"
          className="group rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs transition hover:border-amber-500"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
            <span>Non assignées (unassigned)</span>
            <UserX size={16} className="text-amber-700" />
          </div>
          <p className="mt-2 font-serif-display text-2xl font-semibold text-amber-900">{unassignedThreads}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
            Assigner à un consultant <ArrowRight size={12} />
          </p>
        </Link>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
            <span>Modèles approuvés Meta</span>
            <ShieldCheck size={16} className="text-[#1f9d55]" />
          </div>
          <p className="mt-2 font-serif-display text-2xl font-semibold text-[#1f9d55]">
            {metaTemplates.length}
          </p>
          <p className="mt-1 text-xs text-emerald-900/75">
            Synchronisés avec KwingoChat / Meta
          </p>
        </div>

        <Link
          href="/admin/journal-whatsapp"
          className="group rounded-2xl border border-line bg-white p-4 shadow-2xs transition hover:border-navy"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-navy/65">
            <span>Messages envoyés (7 j)</span>
            <Sparkles size={16} className="text-navy/70" />
          </div>
          <p className="mt-2 font-serif-display text-2xl font-semibold text-navy">{sent7d}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ia-dark">
            Voir le journal & diagnostic <ArrowRight size={12} />
          </p>
        </Link>
      </div>

      {/* SECTION 1 : Modèles approuvés par Meta (synchronisés depuis KwingoChat) */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1f9d55]">
              API Cloud · Compte {kwingoConn.companyName || "Jamaal Luxury"}
            </span>
            <h2 className="mt-1.5 font-serif-display text-lg font-semibold text-navy">
              Modèles WhatsApp approuvés par Meta ({metaTemplates.length})
            </h2>
            <p className="mt-0.5 text-xs text-navy/65">
              Ces modèles sont validés dans le WhatsApp Business Manager Meta de JAMAAL Luxury et sont utilisables dans la Messagerie (réponses API Cloud) ainsi que dans les Campagnes WhatsApp.
            </p>
          </div>
          <Link
            href="/admin/whatsapp/campagnes"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1ebe5b]"
          >
            <Megaphone size={14} /> Nouvelle campagne avec un modèle
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {metaTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between rounded-2xl border border-line bg-cream/25 p-4"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-navy">
                    <CheckCircle2 size={15} className="text-[#1f9d55]" />
                    <code>{tpl.templateName}</code>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase text-navy/75 border border-line">
                      {tpl.category} · {tpl.language}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-[#1f9d55]">
                      ✓ Approuvé Meta
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 rounded-xl bg-white p-3 text-xs leading-relaxed text-navy/80 border border-line/60">
                  {tpl.text}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-navy/55">
                  Utilisable 24h/24 (API Cloud & Campagnes)
                </span>
                <Link
                  href={`/admin/whatsapp/campagnes?templateName=${encodeURIComponent(tpl.templateName)}&templateLanguage=${encodeURIComponent(tpl.language)}`}
                  className="font-semibold text-ia-dark hover:underline"
                >
                  Utiliser dans une campagne →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2 : Personnalisation des messages automatiques JAMAAL */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="mb-4 border-b border-line pb-3">
          <h2 className="font-serif-display text-lg font-semibold text-navy">
            Textes des messages automatiques JAMAAL
          </h2>
          <p className="mt-0.5 text-xs text-navy/65">
            Personnalisez le texte des notifications automatiques (suivi de commande, bienvenue consultant, relances, kit du matin). Les variables entre accolades (ex. <code>{"{prenom}"}</code>, <code>{"{numero}"}</code>) sont remplacées automatiquement à l&apos;envoi.
          </p>
        </div>
        <WhatsAppMessagesEditor
          messages={MESSAGE_KEYS.map((k) => [k, WA_MESSAGES[k]])}
          custom={custom}
        />
      </section>
    </div>
  );
}
