"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Download, LayoutGrid, Megaphone, MessageSquare } from "lucide-react";

const TABS = [
  {
    href: "/admin/whatsapp/conversations",
    label: "1. Messagerie & Conversations",
    shortLabel: "Conversations",
    icon: MessageSquare,
  },
  {
    href: "/admin/whatsapp/campagnes",
    label: "2. Campagnes & Import Excel",
    shortLabel: "Campagnes",
    icon: Megaphone,
  },
  {
    href: "/admin/whatsapp",
    label: "3. Centre & Modèles Meta",
    shortLabel: "Centre & Modèles",
    icon: LayoutGrid,
  },
  {
    href: "/admin/journal-whatsapp",
    label: "4. Journal & Diagnostic",
    shortLabel: "Journal",
    icon: ClipboardList,
  },
  {
    href: "/admin/whatsapp/manuel",
    label: "5. Guide & Manuel",
    shortLabel: "Manuel",
    icon: BookOpen,
  },
] as const;

export function WhatsAppSubNav({
  connected,
  unassignedCount,
}: {
  connected?: boolean;
  unassignedCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation Messagerie WhatsApp JAMAAL"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-2.5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-navy text-white shadow-2xs"
                  : "text-navy/75 hover:bg-cream hover:text-navy"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.href === "/admin/whatsapp/conversations" &&
                typeof unassignedCount === "number" &&
                unassignedCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? "bg-amber-400 text-navy" : "bg-amber-100 text-amber-900"
                    }`}
                    title={`${unassignedCount} conversation(s) non assignée(s)`}
                  >
                    {unassignedCount}
                  </span>
                )}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2 text-xs">
        <a
          href="/api/export/manuel-whatsapp-pdf"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream/60 px-3 py-1 font-semibold text-navy hover:bg-cream"
          title="Télécharger le manuel complet au format PDF (.pdf)"
        >
          <Download size={12} />
          <span>Manuel PDF</span>
        </a>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
            connected !== false
              ? "bg-emerald-50 text-[#1f9d55] border border-emerald-200"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected !== false ? "bg-[#25D366]" : "bg-amber-500"
            }`}
          />
          JAMAAL Luxury · +221 71 180 09 09 (API Cloud)
        </span>
      </div>
    </nav>
  );
}
