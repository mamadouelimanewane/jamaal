"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export function CopyTrackingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
    >
      {copied ? <Check size={16} className="text-emerald-600" /> : <Link2 size={16} />}
      {copied ? "Lien copié !" : "Copier le lien de suivi"}
    </button>
  );
}
