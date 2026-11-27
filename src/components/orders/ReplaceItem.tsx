"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Search, X } from "lucide-react";
import { usePrice, useT } from "@/components/i18n/LocaleProvider";
import { replaceItemAsAdmin, replaceItemAsClient, replaceItemAsReseller, searchReplacementProducts, type ReplacementOption } from "@/lib/actions/order-change";

type Item = { id: string; name: string; volume: string; price: number; quantity: number };
type Mode = "client" | "revendeur" | "admin";

/**
 * « Remplacer » un article d'une commande pas encore livrée : recherche d'un autre produit, choix du format,
 * écart de prix affiché avant de valider (complément à payer, ou différence rendue dans l'avoir).
 */
export function ReplaceItem({ orderId, item, mode, paid, reservation = false }: { orderId: string; item: Item; mode: Mode; paid: boolean; reservation?: boolean }) {
  const t = useT();
  const formatPrice = usePrice();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ReplacementOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<{ product: ReplacementOption; label: string; price: number } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        if (n === seq.current) setResults([]);
        return;
      }
      setSearching(true);
      const r = await searchReplacementProducts(query).catch(() => []);
      if (n === seq.current) {
        setResults(r);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, open]);

  const diff = pick ? (pick.price - item.price) * item.quantity : 0;
  const action = mode === "client" ? replaceItemAsClient : mode === "revendeur" ? replaceItemAsReseller : replaceItemAsAdmin;

  function confirm() {
    if (!pick) return;
    start(async () => {
      const r = await action(orderId, item.id, pick.product.id, pick.label);
      if (r.ok) {
        // Message traduit côté navigateur (le détail des montants s'affiche sur la page rechargée).
        setMsg({ ok: true, text: mode === "client" ? t("Produit remplacé. Vous recevez la confirmation sur WhatsApp.") : r.message });
        setOpen(false);
        setPick(null);
        setQ("");
        router.refresh();
      } else setMsg({ ok: false, text: t(r.error) });
    });
  }

  return (
    <div className="mt-1">
      {!open && (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="inline-flex items-center gap-1 text-xs font-semibold text-navy underline-offset-2 hover:underline">
          <Repeat size={13} /> {t("Remplacer ce produit")}
        </button>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-1 text-xs ${msg.ok ? "text-emerald-800" : "text-rose-dark"}`}>{msg.text}</p>}
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-white p-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-navy">{t("Remplacer « {v0} »", { v0: `${item.name} (${item.volume})` })}</p>
            <button type="button" onClick={() => { setOpen(false); setPick(null); }} aria-label={t("Fermer")} className="text-navy/60 hover:text-navy"><X size={16} /></button>
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-line px-3 py-2">
            <Search size={15} className="text-navy/50" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setPick(null); }} placeholder={t("Nom du parfum, code Chogan…")} className="w-full bg-transparent text-sm outline-none" />
          </label>
          {searching && <p className="mt-2 text-xs text-navy/60">{t("Recherche…")}</p>}
          {!pick && results.length > 0 && (
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
              {results.map((p) => (
                <li key={p.id} className="rounded-lg border border-line p-2">
                  <p className="text-sm font-medium text-navy">{p.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.formats.map((f) => {
                      // Commande normale : le nouveau produit doit être en stock (une réservation accepte un produit en rupture).
                      const blocked = !f.inStock && !reservation;
                      return (
                        <button
                          key={f.label}
                          type="button"
                          disabled={blocked}
                          onClick={() => setPick({ product: p, label: f.label, price: f.price })}
                          className={`rounded-full border px-2.5 py-1 text-xs ${blocked ? "cursor-not-allowed border-line text-navy/40" : "border-navy/30 text-navy hover:bg-cream"}`}
                        >
                          {f.label} · {formatPrice(f.price)}{f.inStock ? "" : ` · ${t("En rupture")}`}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!pick && !searching && q.trim().length >= 2 && results.length === 0 && <p className="mt-2 text-xs text-navy/60">{t("Aucun produit trouvé")}</p>}
          {pick && (
            <div className="mt-3 rounded-lg bg-cream/70 p-3">
              <p className="text-sm text-navy">
                <strong>{pick.product.name}</strong> ({pick.label}) · {formatPrice(pick.price)}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </p>
              <p className="mt-1 text-xs text-navy/80">
                {diff === 0
                  ? t("Même prix : rien à payer en plus.")
                  : diff > 0
                    ? paid || reservation
                      ? t("Complément à payer : {v0}.", { v0: formatPrice(diff) })
                      : t("Le total de la commande augmente de {v0}.", { v0: formatPrice(diff) })
                    : paid
                      ? t("La différence de {v0} sera ajoutée à votre avoir JAMAAL, utilisable sur une prochaine commande.", { v0: formatPrice(-diff) })
                      : t("Le total de la commande baisse de {v0}.", { v0: formatPrice(-diff) })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={pending} onClick={confirm} className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60">
                  {pending ? t("Enregistrement…") : t("Confirmer le remplacement")}
                </button>
                <button type="button" onClick={() => setPick(null)} className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-navy hover:bg-white">
                  {t("Choisir un autre produit")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
