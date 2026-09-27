"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2 } from "lucide-react";
import { ReceiptCard, type ReceiptData } from "./ReceiptCard";

export function ReceiptDownload({ data, clientWhatsapp }: { data: ReceiptData; clientWhatsapp?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function generate(): Promise<string | null> {
    if (!ref.current) return null;
    setBusy(true);
    try {
      return await toPng(ref.current, { pixelRatio: 2 });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    const dataUrl = await generate();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `commande-jamaal-${data.orderId}.png`;
    link.href = dataUrl;
    link.click();
  }

  async function handleShare() {
    const dataUrl = await generate();
    if (!dataUrl) return;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `commande-jamaal-${data.orderId}.png`, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Votre commande JAMAAL",
        text: `Voici le récapitulatif de votre commande JAMAAL, ${data.customerName} !`,
      });
      return;
    }

    const link = document.createElement("a");
    link.download = `commande-jamaal-${data.orderId}.png`;
    link.href = dataUrl;
    link.click();

    const phone = clientWhatsapp?.replace(/\D/g, "");
    const text = encodeURIComponent(
      `Bonjour ${data.customerName}, voici le récapitulatif de votre commande JAMAAL (image téléchargée, à joindre ici) 🌸`
    );
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-50"
        >
          <Download size={16} />
          Télécharger l&apos;image
        </button>
        <button
          onClick={handleShare}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Share2 size={16} />
          Envoyer sur WhatsApp
        </button>
      </div>
      <p className="mt-2 max-w-sm text-xs text-navy/50">
        Sur mobile, « Envoyer sur WhatsApp » ouvre directement le partage de l&apos;image. Sur ordinateur,
        l&apos;image est téléchargée puis WhatsApp Web s&apos;ouvre pour que vous l&apos;joigniez.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl" style={{ width: 480 }}>
        <div ref={ref}>
          <ReceiptCard data={data} />
        </div>
      </div>
    </div>
  );
}
