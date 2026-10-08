"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

/**
 * Carte « Mon lien personnel » pour le dashboard consultant.
 * À placer dans ConsultantOverview (page.tsx admin dashboard).
 */
export function PersonalLinkCard({
  slug,
  siteOrigin = "",
}: {
  slug: string | null | undefined;
  /** Ex. process.env.NEXT_PUBLIC_SITE_URL ou window.location.origin côté client */
  siteOrigin?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!slug) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">
          Lien personnel
        </p>
        <p className="mt-2 text-sm text-navy/75">
          Votre lien n&apos;est pas encore configuré. Demandez à l&apos;administrateur d&apos;ajouter
          un slug sur votre profil consultant.
        </p>
      </div>
    );
  }

  const path = `/c/${slug}`;
  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : siteOrigin
        ? `${siteOrigin.replace(/\/$/, "")}${path}`
        : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencieux
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">
        Votre lien personnel
      </p>
      <p className="mt-1 text-sm text-navy/85">
        Partagez ce lien : toute commande passée via ce lien vous sera automatiquement attribuée.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-navy/5 px-3 py-2.5">
        <code className="flex-1 truncate text-xs font-semibold text-navy sm:text-sm">
          {fullUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-dark hover:underline"
      >
        <ExternalLink size={13} />
        Ouvrir ma page publique
      </a>
    </div>
  );
}
