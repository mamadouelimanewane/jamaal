"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Plus, Loader2, Trash2, Download, QrCode } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  discountPct: number;
  description: string | null;
  usageLimit: number;
  usedCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}

interface PromoCodeManagerProps {
  consultantId: string;
  initialCodes: PromoCode[];
}

export function PromoCodeManager({ consultantId, initialCodes }: PromoCodeManagerProps) {
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ discountPct: 5, description: "", usageLimit: 0, expiresInDays: 30 });

  const generateCode = async () => {
    setLoading(true);
    const res = await fetch("/api/promo/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consultantId, ...form }),
    });
    const data = await res.json();
    if (data.success) setCodes((prev) => [data.promo, ...prev]);
    setLoading(false);
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareUrl = (code: string) =>
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://jamaal-nine.vercel.app"}/?promo=${code}`;

  return (
    <div className="space-y-6">
      {/* Formulaire génération */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-navy">Générer un nouveau code promo</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-navy/50 mb-1">Remise (%)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.discountPct}
              onChange={(e) => setForm((f) => ({ ...f, discountPct: +e.target.value }))}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-navy outline-none focus:border-rose focus:ring-2 focus:ring-rose/10"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-navy/50 mb-1">Limite d&apos;utilisation (0=∞)</label>
            <input
              type="number"
              min={0}
              value={form.usageLimit}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: +e.target.value }))}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-navy outline-none focus:border-rose focus:ring-2 focus:ring-rose/10"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-navy/50 mb-1">Validité (jours)</label>
            <input
              type="number"
              min={1}
              value={form.expiresInDays}
              onChange={(e) => setForm((f) => ({ ...f, expiresInDays: +e.target.value }))}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-navy outline-none focus:border-rose focus:ring-2 focus:ring-rose/10"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-navy/50 mb-1">Description (optionnel)</label>
            <input
              type="text"
              placeholder="Ex: Lancement Octobre"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-line bg-cream px-3 py-2.5 text-sm text-navy outline-none focus:border-rose focus:ring-2 focus:ring-rose/10"
            />
          </div>
        </div>
        <button
          onClick={generateCode}
          disabled={loading}
          className="mt-4 flex items-center gap-2 rounded-full bg-rose-dark px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Générer mon code
        </button>
      </div>

      {/* Liste des codes */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy">Mes codes promo ({codes.length})</h2>
        </div>
        {codes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy/40">Aucun code pour l&apos;instant. Générez votre premier code ci-dessus.</p>
        ) : (
          <div className="divide-y divide-line">
            {codes.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xl font-bold text-navy tracking-widest">{c.code}</span>
                    <span className="rounded-full bg-rose/20 px-2 py-0.5 text-xs font-semibold text-rose-dark">-{c.discountPct}%</span>
                    {c.expiresAt && new Date(c.expiresAt) < new Date() && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Expiré</span>
                    )}
                  </div>
                  {c.description && <p className="text-xs text-navy/60 mt-0.5">{c.description}</p>}
                  <p className="text-xs text-navy/40 mt-0.5">
                    {c.usedCount}/{c.usageLimit === 0 ? "∞" : c.usageLimit} utilisations
                    {c.expiresAt && ` · Expire le ${new Date(c.expiresAt).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyCode(c.code, c.id)}
                    title="Copier le code"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-cream"
                  >
                    {copiedId === c.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} className="text-navy" />}
                  </button>
                  <button
                    onClick={() => setQrTarget(qrTarget === c.id ? null : c.id)}
                    title="QR Code"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-cream"
                  >
                    <QrCode size={15} className="text-navy" />
                  </button>
                </div>

                {/* QR Code expandable */}
                {qrTarget === c.id && (
                  <div className="w-full pt-3 pb-1 flex flex-col items-center gap-3">
                    <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
                      <QRCodeSVG value={shareUrl(c.code)} size={160} />
                    </div>
                    <p className="text-xs text-navy/50 break-all">{shareUrl(c.code)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
