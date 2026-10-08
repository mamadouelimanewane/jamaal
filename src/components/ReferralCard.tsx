"use client";

import { useState } from "react";
import { Copy, Check, Share2, Gift } from "lucide-react";

interface ReferralCardProps {
  code: string;
  referrerId: string;
  usedAt?: Date | null;
  rewardPoints: number;
}

export function ReferralCard({ code, usedAt, rewardPoints }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://jamaal-nine.vercel.app"}/?ref=${code}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `🌸 Découvre JAMAAL Luxury Cosmetics — des parfums premium à prix juste !\nUtilise mon lien et obtiens une remise exclusive : ${shareUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose/20">
          <Gift size={22} className="text-rose-dark" />
        </div>
        <div>
          <p className="font-serif-display font-semibold text-navy text-lg">Mon code ambassadeur</p>
          <p className="text-xs text-navy/50">Partagez — votre ami(e) obtient une remise, vous gagnez des points</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-cream border border-line px-4 py-3 mb-4">
        <span className="font-mono text-2xl font-bold tracking-widest text-navy flex-1">{code}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-navy-light"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>

      <button
        onClick={shareWhatsApp}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-emerald-600 hover:shadow-lg"
      >
        <Share2 size={16} />
        Partager sur WhatsApp
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-cream p-3 text-center">
          <p className="text-xs text-navy/50 uppercase tracking-wide">Récompense</p>
          <p className="mt-1 text-lg font-bold text-rose-dark">+{rewardPoints.toLocaleString()} pts</p>
        </div>
        <div className="rounded-xl bg-cream p-3 text-center">
          <p className="text-xs text-navy/50 uppercase tracking-wide">Statut</p>
          <p className={`mt-1 text-lg font-bold ${usedAt ? "text-emerald-600" : "text-navy/40"}`}>
            {usedAt ? "Utilisé ✓" : "En attente"}
          </p>
        </div>
      </div>
    </div>
  );
}
