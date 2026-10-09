"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Navigation, Phone, TriangleAlert } from "lucide-react";
import { livreurAdvanceDelivery } from "@/lib/actions/delivery";
import { DELIVERY_LABELS, directionsUrl, type DeliveryStatus } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";

/** Position actuelle du téléphone (null si refusée ou indisponible). */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  });
}

const NEXT: Partial<Record<DeliveryStatus, { to: DeliveryStatus; label: string }>> = {
  ASSIGNEE: { to: "RECUPEREE", label: "J'ai récupéré le colis" },
  RECUPEREE: { to: "EN_ROUTE", label: "Je pars livrer" },
};

export function LivreurDeliveryCard(props: {
  id: string;
  customerName: string;
  customerPhone: string | null;
  /** Livraison chez le vendeur qui achète pour son client : nom du client final. */
  forCustomer?: string | null;
  address: string | null;
  total: number;
  paid: boolean;
  status: DeliveryStatus;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  share: number;
  /** Position estimée à partir d'une adresse floue : appeler avant de partir. */
  approx?: boolean;
  place?: string | null;
  /** Commande passée par quelqu'un d'autre que le destinataire. */
  orderedBy?: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const next = NEXT[props.status];
  const phone = props.customerPhone?.replace(/\D/g, "") ?? "";

  function act(to: DeliveryStatus, extra: { code?: string; note?: string } = {}) {
    setError(null);
    start(async () => {
      const pos = await currentPosition();
      const res = await livreurAdvanceDelivery(props.id, to, { ...pos, ...extra });
      if (!res.ok) setError(res.error ?? "Action impossible.");
      else {
        setCode("");
        setProblem(null);
      }
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-ink">{props.customerName}</p>
          {props.forCustomer && <p className="text-sm font-medium text-amber-800">Consultant·e JAMAAL · commande pour {props.forCustomer}</p>}
          {props.orderedBy && <p className="text-sm font-medium text-navy/80">Commandé par {props.orderedBy}</p>}
          <p className="text-[15px] text-navy/85">{props.address ?? "Adresse non renseignée"}</p>
        </div>
        <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-ink">{DELIVERY_LABELS[props.status]}</span>
      </div>

      {props.approx && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span><strong>Position approximative</strong>{props.place ? ` (${props.place})` : ""} — appelez le destinataire avant de partir pour confirmer l&apos;endroit exact.</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy/85">
        {props.distanceKm != null && <span>{props.distanceKm.toLocaleString("fr-FR")} km du dépôt</span>}
        <span>{props.paid ? `Payée (${formatPrice(props.total)})` : `À encaisser : ${formatPrice(props.total)}`}</span>
        {props.share > 0 && <span className="font-semibold text-emerald-800">Ma part : {formatPrice(props.share)}</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {props.lat != null && props.lng != null && (
          <a href={directionsUrl({ lat: props.lat, lng: props.lng })} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            <Navigation size={15} /> Itinéraire
          </a>
        )}
        {phone && (
          <>
            <a href={`tel:+${phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-cream"><Phone size={15} /> Appeler</a>
            <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-cream"><MessageCircle size={15} /> WhatsApp</a>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {next && (
          <button type="button" disabled={pending} onClick={() => act(next.to)} className="w-full rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto">
            {pending ? "Envoi…" : next.label}
          </button>
        )}
        {props.status === "EN_ROUTE" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("LIVREE", { code });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm font-medium text-ink">
              Code donné par le client
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="\d{4}" required placeholder="0000" className="mt-1.5 block w-32 rounded-xl border border-line px-3 py-2.5 text-center text-xl font-semibold tracking-[0.4em] text-ink outline-none focus:border-navy" />
            </label>
            <button disabled={pending || code.length !== 4} className="rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
              {pending ? "Vérification…" : "Confirmer la livraison"}
            </button>
          </form>
        )}

        {problem === null ? (
          <button type="button" onClick={() => setProblem("")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline">
            <TriangleAlert size={15} /> Signaler un problème
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium text-ink">
              Raison
              <select value={problem} onChange={(e) => setProblem(e.target.value)} className="mt-1.5 block w-full rounded-xl border border-line px-3 py-2.5 text-[15px]">
                <option value="">Choisir…</option>
                <option>Client injoignable</option>
                <option>Client absent</option>
                <option>Adresse introuvable</option>
                <option>Client refuse le colis</option>
                <option>Colis endommagé</option>
              </select>
            </label>
            <button type="button" disabled={pending || !problem} onClick={() => act("ECHEC", { note: problem ?? "" })} className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Signaler</button>
            <button type="button" onClick={() => setProblem(null)} className="px-2 py-2.5 text-sm text-navy/80">Annuler</button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      </div>
    </li>
  );
}
