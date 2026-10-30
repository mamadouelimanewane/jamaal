"use client";

import { offeredCounts, type InstallmentSettings } from "@/lib/installments";
import { startTransition as dispatch, useActionState, useState, useTransition } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { searchProductsForOrder, type ProductSearchResult } from "@/lib/actions/product-search";
import { createConsultantOrder, type ConsultantOrderState } from "@/lib/actions/consultant-orders";
import { formatPrice } from "@/lib/currency";
import { ConsultantDeliveryFields } from "./ConsultantDeliveryFields";
import { COLLECT_LABELS, type CollectMethod, type SpecialZone } from "@/lib/special-terms";

type PayMode = "livraison" | "wallet" | "wave" | "orange_money" | "lien";

interface LineItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export function ConsultantOrderForm({
  depot,
  vendor,
  walletBalance = 0,
  special,
  onlinePay = [],
  installments = null,
  me = null,
}: {
  depot: { lat: number; lng: number; label: string };
  vendor: { address: string | null; lat: number | null; lng: number | null };
  walletBalance?: number;
  /** Conditions spéciales du revendeur : encaissement direct et zones de livraison propres. */
  special?: { collect: CollectMethod[]; creditLimit: number; zones: SpecialZone[] } | null;
  /** Moyens de paiement en ligne actifs (Wave, Orange Money…), vide si aucun. */
  onlinePay?: { id: string; label: string }[];
  /** Le vendeur lui-même (commande pour son propre compte). */
  me?: { name: string; phone: string | null } | null;
  /** Paiement en plusieurs fois (réglages JAMAAL), proposé avec le lien de paiement. */
  installments?: InstallmentSettings | null;
}) {
  const [collect, setCollect] = useState<"NON" | CollectMethod>("NON");
  const [forSelf, setForSelf] = useState(false);
  const [payModeRaw, setPayMode] = useState<PayMode>("livraison");
  const [fee, setFee] = useState(0);
  const [parts, setParts] = useState(1);
  const owed = Math.max(0, -walletBalance);
  const [query, setQuery] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [state, submitAction, submitting] = useActionState(createConsultantOrder, { ok: false } as ConsultantOrderState);

  function search(value: string) {
    setQuery(value);
    startTransition(async () => {
      const r = await searchProductsForOrder(value);
      setResults(r);
    });
  }

  function addItem(product: ProductSearchResult, volumeLabel: string, price: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.volumeLabel === volumeLabel);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { productId: product.id, productName: product.name, volumeLabel, price, quantity: 1 }];
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const due = total + fee;
  const walletShort = Math.max(0, due - walletBalance);
  // Encaissement direct : pas d'autre paiement ; « lien au client » n'existe pas pour soi-même.
  const payMode: PayMode = collect !== "NON" ? "livraison" : forSelf && payModeRaw === "lien" ? "livraison" : payModeRaw === "wallet" && (walletBalance <= 0 || (items.length > 0 && walletShort > 0)) ? "livraison" : payModeRaw;
  const payLink = payMode === "lien";
  const partsOk = (n: number) => n === 1 || (!!installments && offeredCounts(total, installments).includes(n));

  const payOption = (mode: PayMode, emoji: string, title: string, hint: string, disabled: boolean) => (
    <button key={mode} type="button" role="radio" aria-checked={payMode === mode} disabled={disabled} onClick={() => setPayMode(mode)} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm ${payMode === mode ? "border-navy bg-navy/5 ring-2 ring-navy/20" : "border-line bg-white hover:border-navy/40"} disabled:cursor-not-allowed disabled:opacity-50`}>
      <span className="text-xl" aria-hidden="true">{emoji}</span>
      <span><strong className="text-navy">{title}</strong><span className="block text-xs text-navy/75">{hint}</span></span>
    </button>
  );

  return (
    <form
      // Envoi manuel : un envoi par « action » viderait les champs après une erreur de saisie.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        dispatch(() => submitAction(fd));
      }}
      className="mt-6 grid gap-6 lg:grid-cols-2"
    >
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">1. Ajouter des produits</h2>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/65" />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Nom, code (ex. 001M), catégorie ou n° de fiche…"
            className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </div>

        <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {isPending && <p className="text-xs text-navy/65">Recherche…</p>}
          {results.map((p) => {
            const volumes = p.volumes?.length ? p.volumes : [{ label: "Format unique", price: p.regularPrice ?? 0 }];
            return (
              <div key={p.id} className="rounded-xl border border-line p-3">
                <p className="text-sm font-medium text-navy">{p.name}{p.choganCode ? <span className="ml-1.5 text-xs font-normal text-navy/70">Code {p.choganCode}</span> : null}{p.number ? <span className="ml-1.5 text-xs font-normal text-navy/60">· Fiche {p.number}</span> : null}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {volumes.map((v) => (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => addItem(p, v.label, v.price)}
                      className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-navy hover:bg-cream"
                    >
                      <Plus size={12} />
                      {v.label} — {formatPrice(v.price)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-navy/70">
          Articles sélectionnés
        </h3>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm">
              <span>
                {item.productName} — {item.volumeLabel} × {item.quantity}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-navy">{formatPrice(item.price * item.quantity)}</span>
                <button type="button" onClick={() => removeItem(i)} className="text-rose-dark">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && <p className="text-xs text-navy/65">Aucun article ajouté.</p>}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-navy">
          <span>Total des produits</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">2. Pour qui ?</h2>
        <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Commande pour">
          {([[true, "Pour moi-même"], [false, "Pour un client"]] as const).map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={forSelf === v} onClick={() => setForSelf(v)} disabled={v && !me} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${forSelf === v ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:bg-cream"} disabled:opacity-40`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {forSelf && me ? (
            <div className="rounded-xl border border-line bg-cream/60 px-4 py-3 text-sm text-navy">
              <input type="hidden" name="forSelf" value="on" />
              <input type="hidden" name="customerName" value={me.name} />
              <input type="hidden" name="customerPhone" value={me.phone ?? ""} />
              Commande à votre nom : <strong>{me.name}</strong>{me.phone ? ` · ${me.phone}` : ""}
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Nom du client</label>
                <input name="customerName" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Téléphone (WhatsApp)</label>
                <input name="customerPhone" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Adresse du client</label>
                <textarea name="address" rows={2} placeholder="Quartier, rue, repère" className={inputClass} />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Code promo (facultatif)</label>
            <input name="couponCode" autoCapitalize="characters" placeholder="Ex. VEN-7KQ2MX" className={`${inputClass} uppercase`} />
          </div>

          <ConsultantDeliveryFields productsTotal={total} depot={depot} vendor={vendor} customerPhone={customerPhone} zones={special?.zones ?? []} forSelf={forSelf} onFee={setFee} />

          {!forSelf && special && special.collect.length > 0 && (
            <fieldset className="rounded-xl border border-ia/30 bg-ia-light/60 px-4 py-3 text-sm text-navy">
              <legend className="px-1 text-sm font-semibold">Mon client m&apos;a déjà payé ?</legend>
              <input type="hidden" name="collect" value={collect} />
              <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Encaissement">
                {(["NON", ...special.collect] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={collect === m}
                    onClick={() => setCollect(m)}
                    disabled={payLink && m !== "NON"}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${collect === m ? "bg-navy text-white" : "border border-line bg-white text-navy hover:bg-cream"}`}
                  >
                    {m === "NON" ? "Non, pas encore" : `Oui, en ${COLLECT_LABELS[m]}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-navy/75">
                {collect === "NON"
                  ? "La commande attend son paiement (à la livraison ou plus tard)."
                  : `Commande payée tout de suite. Le montant (produits + livraison) est porté au débit de votre wallet : c'est l'argent à reverser à JAMAAL, vos commissions viennent en déduction.`}
                {" "}Déjà à reverser : <strong>{owed.toLocaleString("fr-FR")} F</strong> · plafond {special.creditLimit.toLocaleString("fr-FR")} F.
              </p>
            </fieldset>
          )}

          <fieldset className="space-y-2" disabled={collect !== "NON"}>
            <legend className="text-sm font-semibold text-navy">4. Paiement</legend>
            {payMode === "wallet" && <input type="hidden" name="payWithWallet" value="on" />}
            {payMode === "lien" && <input type="hidden" name="payLink" value="on" />}
            {(payMode === "wave" || payMode === "orange_money") && <input type="hidden" name="payNow" value={payMode} />}
            {collect !== "NON" && <p className="text-xs text-navy/70">Votre client vous a déjà payé : rien d&apos;autre à régler.</p>}
            {payOption("wallet", "👛", "Payer avec mon wallet", walletBalance > 0
              ? walletShort > 0 && items.length > 0
                ? `Solde ${formatPrice(walletBalance)} : il manque ${formatPrice(walletShort)}. Rechargez votre wallet ou choisissez un autre paiement.`
                : `Solde ${formatPrice(walletBalance)} · vos commissions paient la commande, sans retrait.`
              : "Solde à 0 F pour le moment.", walletBalance <= 0 || (items.length > 0 && walletShort > 0))}
            {onlinePay.filter((o) => o.id === "wave" || o.id === "orange_money").map((o) => payOption(o.id as PayMode, o.id === "wave" ? "💙" : "🧡", `Je paie maintenant avec ${o.label}`, "Vous êtes envoyé vers la page de paiement ; la commande est confirmée dès le paiement reçu.", false))}
            {!forSelf && onlinePay.length > 0 && payOption("lien", "📲", "Envoyer un lien de paiement à mon client", `${onlinePay.map((o) => o.label).join(" ou ")} : il paie en ligne, la commande et vos commissions se confirment toutes seules.`, false)}
            {payOption("livraison", "💵", forSelf ? "Payer à la livraison" : "Le client paie à la livraison", "Le livreur encaisse à la remise du colis.", false)}
          </fieldset>
          {payMode === "lien" && installments && offeredCounts(total, installments).length > 0 && (
            <fieldset className="-mt-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm text-navy">
              <legend className="px-1 text-xs font-semibold">Mon client paie</legend>
              <input type="hidden" name="installments" value={partsOk(parts) ? parts : 1} />
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nombre de paiements">
                {[1, ...offeredCounts(total, installments)].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={(partsOk(parts) ? parts : 1) === n} onClick={() => setParts(n)} className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-semibold ${(partsOk(parts) ? parts : 1) === n ? "bg-navy text-white" : "border border-line bg-white text-navy hover:bg-cream"}`}>
                    {n === 1 ? "En 1 fois" : `En ${n} fois`}
                  </button>
                ))}
              </div>
              {partsOk(parts) && parts > 1 && (
                <p className="mt-2 text-xs text-navy/75">Une échéance tous les {installments.intervalDays} jours avec rappel WhatsApp au client. Livraison et commissions une fois tout réglé.</p>
              )}
            </fieldset>
          )}

          {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{state.error}</p>}
          <button
            type="submit"
            disabled={items.length === 0 || submitting}
            className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-50"
          >
            {submitting ? "Enregistrement…" : payMode === "wave" || payMode === "orange_money" ? `Commander et payer ${formatPrice(due)}` : payMode === "wallet" ? `Commander et payer avec mon wallet (${formatPrice(due)})` : "Enregistrer la commande"}
          </button>
        </div>
      </div>
    </form>
  );
}
