"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

/** QR code du lien personnel, téléchargeable en PNG (cartes de visite, flyers, vitrine). */
export function QrCard({ url, name }: { url: string; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-line bg-white p-4">
        <QRCodeCanvas ref={ref} value={url} size={168} marginSize={2} fgColor="#1d2f4f" />
      </div>
      <button
        type="button"
        onClick={() => {
          const canvas = ref.current;
          if (!canvas) return;
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = `qr-jamaal-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
          a.click();
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
      >
        <Download size={13} /> Télécharger le QR code
      </button>
    </div>
  );
}
