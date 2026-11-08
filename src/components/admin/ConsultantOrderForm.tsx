"use client";

import { offeredCounts, type InstallmentSettings } from "@/lib/installments";
import { startTransition as dispatch, useActionState, useState, useTransition } from "react";
import { Check, Contact, Handshake, Loader2, Minus, Plus, Search, Trash2, User, X } from "lucide-react";
import { searchProductsForOrder, type ProductSearchResult } from "@/lib/actions/product-search";
import { createConsultantOrder, type ConsultantOrderState } from "@/lib/actions/consultant-orders";
import { formatPrice } from "@/lib/currency";
import { ConsultantDeliveryFields } from "./ConsultantDeliveryFields";
import { COLLECT_LABELS, type CollectMethod, type SpecialZone } from "@/lib/special-terms";

type PayMode = "livraison" | "wallet" | "wave" | "orange_money" | "lien";

export interface LineItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
  /** Formats proposés (changement de format sur la ligne) ; non envoyé au serveur. */
  options?: { label: string; price: number }[];
  photo?: string | null;
}

type SavedClient = { name: string; phone: string; address?: string | null };

const inputClass =
  "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export function ConsultantOrderForm({
  depot,
  vendor,
  walletBalance = 0,
  special,
  onlinePay = [],
  installments = null,
  me = null,
  initialItems = [],
  initialForSelf = false,
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
  /** Produits déjà choisis (bouton « Acheter » d'une fiche ou d'une sélection). */
  initialItems?: LineItem[];
  /** « Pour moi » coché d'emblée. */
  initialForSelf?: boolean;
}) {
  const [collect, setCollect] = useState<"NON" | CollectMethod>("NON");
  const [forSelf, setForSelf] = useState(initialForSelf && !!me);
  const [payModeRaw, setPayMode] = useState<PayMode>("livraison");
  const [fee, setFee] = useState(0);
  const [parts, setParts] = useState(1);
  const owed = Math.max(0, -walletBalance);
  const [query, setQuery] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [clients, setClients] = useState<SavedClient[] | null>(null);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [pickMsg, setPickMsg] = useState<string | null>(null);
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [items, setItems] = useState<LineItem[]>(initialItems);
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
    const options = product.volumes?.length ? product.volumes : [{ label: "Format unique", price: product.regularPrice ?? 0 }];
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.volumeLabel === volumeLabel);
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, quantity: Math.min(50, i.quantity + 1) } : i));
      }
      return [...prev, { productId: product.id, productName: product.name, volumeLabel, price, quantity: 1, options, photo: product.photo }];
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const setQty = (index: number, q: number) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, Math.min(50, q)) } : it)));

  /** Changer de format sur la ligne (fusionne avec une ligne du même format). */
  function setFormat(index: number, label: string) {
    setItems((prev) => {
      const it = prev[index];
      const opt = it.options?.find((o) => o.label === label);
      if (!opt) return prev;
      const twin = prev.findIndex((x, i) => i !== index && x.productId === it.productId && x.volumeLabel === label);
      if (twin >= 0) return prev.map((x, i) => (i === twin ? { ...x, quantity: Math.min(50, x.quantity + it.quantity) } : x)).filter((_, i) => i !== index);
      return prev.map((x, i) => (i === index ? { ...x, volumeLabel: opt.label, price: opt.price } : x));
    });
  }

  function chooseClient(c: SavedClient) {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    if (c.address) setAddress(c.address);
    setClientsOpen(false);
    setPickMsg(`Client choisi : ${c.name}`);
  }

  async function openClients() {
    setClientsOpen(true);
    if (clients) return;
    try {
      const r = await fetch("/api/reseller/clients");
      setClients(r.ok ? ((await r.json()).clients ?? []) : []);
    } catch {
      setClients([]);
    }
  }

  /** Carnet du téléphone (Android avec Chrome). */
  async function pickContact() {
    const api = (navigator as Navigator & { contacts?: { select: (p: string[], o: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[]; address?: { addressLine?: string[]; city?: string }[] }[]> } }).contacts;
    if (!api?.select) {
      setPickMsg("Le carnet du téléphone n'est pas accessible depuis ce navigateur (Android avec Chrome seulement) : choisissez dans « Mes clients » ou saisissez le numéro.");
      return;
    }
    try {
      const [c] = await api.select(["name", "tel"], { multiple: false });
      if (!c) return;
      if (c.name?.[0]) setCustomerName(c.name[0]);
      if (c.tel?.[0]) setCustomerPhone(c.tel[0]);
      setPickMsg(c.name?.[0] ? `Contact choisi : ${c.name[0]}` : "Contact choisi.");
    } catch {
      setPickMsg(null);
    }
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
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, productName: i.productName, volumeLabel: i.volumeLabel, price: i.price, quantity: i.quantity })))} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy">1. Pour qui ?</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Commande pour">
          {([[true, "Pour moi-même", "Je reçois et je paie"], [false, "Pour un client", "Livré chez mon client"]] as const).map(([v, label, hint]) => {
            const on = forSelf === v;
            const tone = v ? { on: "border-[#15803D] bg-[#16A34A] text-white", off: "border-[#16A34A] bg-white text-[#15803D]" } : { on: "border-navy bg-navy text-white", off: "border-navy bg-white text-navy" };
            const Icon = v ? User : Handshake;
            return (
              <button key={label} type="button" role="radio" aria-checked={on} onClick={() => setForSelf(v)} disabled={v && !me} className={`flex items-center gap-2 rounded-2xl border-2 px-2.5 py-3 text-left transition disabled:opacity-40 ${on ? `${tone.on} shadow-md` : `${tone.off} hover:shadow-sm`}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-white bg-white" : "border-current"}`} aria-hidden="true">
                  {on && <Check size={12} strokeWidth={3} className={v ? "text-[#16A34A]" : "text-navy"} />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 whitespace-nowrap text-sm font-bold"><Icon size={14} className="shrink-0" /> {label}</span>
                  <span className={`block text-[11px] ${on ? "text-white/85" : "opacity-75"}`}>{hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <h2 className="mb-3 mt-6 text-sm font-semibold text-navy">2. Les produits</h2>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/65" />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Nom, code ou parfum…"
            aria-label="Rechercher un produit : nom, code (ex. 001M), parfum d'inspiration, catégorie ou n° de fiche"
            enterKeyHint="search"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-navy"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setResults([]); }} aria-label="Effacer la recherche" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-navy/50 hover:bg-cream">
              <X size={15} />
            </button>
          )}
        </div>

        {(isPending || results.length > 0) && (
          <div className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-white p-2">
            {isPending && <p className="flex items-center gap-1.5 px-1 text-xs text-navy/65"><Loader2 size={13} className="animate-spin" /> Recherche…</p>}
            {results.map((p) => {
              const volumes = p.volumes?.length ? p.volumes : [{ label: "Format unique", price: p.regularPrice ?? 0 }];
              return (
                <div key={p.id} className="flex gap-3 rounded-lg p-1.5 hover:bg-cream/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photo ? <img src={p.photo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain" /> : <span className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-navy to-[#c9997a]" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{p.name}</p>
                    <p className="text-[11px] text-navy/60">{[p.choganCode && `Code ${p.choganCode}`, p.number && `Fiche ${p.number}`].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {volumes.map((v) => {
                        const inCart = items.some((i) => i.productId === p.id && i.volumeLabel === v.label);
                        return (
                          <button key={v.label} type="button" onClick={() => addItem(p, v.label, v.price)} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${inCart ? "bg-emerald-100 text-emerald-800" : "bg-navy text-white hover:bg-navy-light"}`}>
                            {inCart ? <Check size={12} /> : <Plus size={12} />}
                            {volumes.length > 1 || v.label !== "Format unique" ? `${v.label} · ` : ""}{formatPrice(v.price)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-navy/70">
          Articles choisis{items.length ? ` (${items.reduce((n, i) => n + i.quantity, 0)})` : ""}
        </h3>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={`${item.productId}-${item.volumeLabel}`} className="flex gap-3 rounded-xl border border-line bg-white p-2.5 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item.photo ? <img src={item.photo} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-line object-contain" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 font-medium leading-snug text-navy">{item.productName}</p>
                  <button type="button" onClick={() => removeItem(i)} aria-label={`Retirer ${item.productName}`} className="shrink-0 rounded-full p-1 text-rose-dark hover:bg-rose/10">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  {item.options && item.options.length > 1 ? (
                    <select value={item.volumeLabel} onChange={(e) => setFormat(i, e.target.value)} aria-label="Format" className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-navy">
                      {item.options.map((o) => (
                        <option key={o.label} value={o.label}>{o.label} — {formatPrice(o.price)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-navy/65">{item.volumeLabel}</span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-full border border-line bg-white">
                      <button type="button" onClick={() => setQty(i, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Un de moins" className="flex h-8 w-8 items-center justify-center rounded-full text-navy disabled:opacity-30"><Minus size={14} /></button>
                      <span className="min-w-6 text-center text-sm font-semibold text-navy" aria-live="polite">{item.quantity}</span>
                      <button type="button" onClick={() => setQty(i, item.quantity + 1)} disabled={item.quantity >= 50} aria-label="Un de plus" className="flex h-8 w-8 items-center justify-center rounded-full text-navy disabled:opacity-30"><Plus size={14} /></button>
                    </div>
                    <span className="min-w-20 text-right font-semibold text-navy">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-navy/65">Aucun article : cherchez un produit ci-dessus.</p>}
        </ul>
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-navy">
          <span>Total des produits</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <div className="pb-24 lg:pb-0">
        <h2 className="mb-3 text-sm font-semibold text-navy">{forSelf ? "3. Mes coordonnées" : "3. Le client"}</h2>
        <div className="grid gap-3">
          {forSelf && me ? (
            <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-navy">
              <input type="hidden" name="forSelf" value="on" />
              <input type="hidden" name="customerName" value={me.name} />
              <input type="hidden" name="customerPhone" value={me.phone ?? ""} />
              Commande à votre nom : <strong>{me.name}</strong>{me.phone ? ` · ${me.phone}` : ""}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={openClients} className="inline-flex items-center gap-1.5 rounded-full border border-navy/25 bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-cream">
                  <User size={14} className="text-rose-dark" /> Mes clients
                </button>
                <button type="button" onClick={pickContact} className="inline-flex items-center gap-1.5 rounded-full border border-navy/25 bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-cream">
                  <Contact size={14} className="text-rose-dark" /> Contacts du téléphone
                </button>
              </div>
              {pickMsg && <p role="status" className="-mt-1 text-xs text-emerald-800">{pickMsg}</p>}
              <div>
                <label className={labelClass} htmlFor="co-name">Nom du client</label>
                <input id="co-name" name="customerName" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="off" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="co-phone">Téléphone (WhatsApp)</label>
                <input id="co-phone" name="customerPhone" type="tel" inputMode="tel" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="77 123 45 67" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="co-address">Adresse du client</label>
                <textarea id="co-address" name="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Quartier, rue, repère" className={inputClass} />
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
            <legend className="text-sm font-semibold text-navy">5. Paiement</legend>
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
        </div>
      </div>

      {/* Total et validation toujours visibles (en bas de l'écran sur téléphone). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(22,35,58,0.08)] backdrop-blur lg:static lg:col-span-2 lg:rounded-2xl lg:border lg:pb-3 lg:shadow-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 pr-16 lg:pr-0">
          <div className="min-w-0 text-navy">
            <p className="text-[11px] uppercase tracking-wide text-navy/60">Total{fee ? " avec livraison" : ""}</p>
            <p className="whitespace-nowrap text-lg font-bold leading-tight">{formatPrice(due)}</p>
            {payMode === "wallet" && <p className="text-[11px] text-emerald-700">Wallet : {formatPrice(walletBalance)} → reste {formatPrice(Math.max(0, walletBalance - due))}</p>}
          </div>
          <button
            type="submit"
            disabled={items.length === 0 || submitting}
            className="shrink-0 rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-50"
          >
            {submitting ? "Enregistrement…" : payMode === "wave" || payMode === "orange_money" ? "Commander et payer" : payMode === "wallet" ? "Payer avec mon wallet" : payMode === "lien" ? "Envoyer le lien" : "Valider la commande"}
          </button>
        </div>
      </div>

      {clientsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Mes clients" onClick={() => setClientsOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold text-navy">Mes clients</p>
              <button type="button" onClick={() => setClientsOpen(false)} aria-label="Fermer" className="rounded-full p-1.5 text-navy/60 hover:bg-cream"><X size={18} /></button>
            </div>
            <div className="p-3">
              <input value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} placeholder="Nom ou numéro…" aria-label="Chercher un client" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy" />
            </div>
            <ul className="max-h-[55vh] overflow-y-auto px-3 pb-3">
              {clients === null && <li className="flex items-center gap-2 px-2 py-3 text-sm text-navy/60"><Loader2 size={15} className="animate-spin" /> Chargement…</li>}
              {clients?.length === 0 && <li className="px-2 py-3 text-sm text-navy/60">Pas encore de client : ils apparaissent ici après leur première commande.</li>}
              {clients
                ?.filter((c) => { const q = clientQuery.trim().toLowerCase(); return !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§"); })
                .map((c) => (
                  <li key={c.phone}>
                    <button type="button" onClick={() => chooseClient(c)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-navy">{c.name}</span>
                        <span className="block truncate text-xs text-navy/60">{c.phone}{c.address ? ` · ${c.address}` : ""}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-navy/5 px-2.5 py-1 text-[11px] font-semibold text-navy">Choisir</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </form>
  );
}
