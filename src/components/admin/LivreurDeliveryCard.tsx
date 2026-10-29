"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageCircle, Navigation, Phone } from "lucide-react";
import { livreurAdvanceDelivery } from "@/lib/actions/delivery";
import { directionsUrl, type DeliveryStatus } from "@/lib/delivery";
import { formatPrice } from "@/lib/currency";
import { ListenButton } from "@/components/livreur/Listen";

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

/** Chaque étape a sa couleur, son image et UN grand bouton vert (texte blanc lisible, contraste AA). */
const STEP: Partial<Record<DeliveryStatus, { color: string; soft: string; emoji: string; title: string; next?: { to: DeliveryStatus; label: string; emoji: string }; say: string }>> = {
  ASSIGNEE: { color: "#6D4AFF", soft: "#F5F3FF", emoji: "📦", title: "Aller chercher le colis", next: { to: "RECUPEREE", label: "J'ai le colis", emoji: "✋" }, say: "Allez chercher le colis au dépôt JAMAAL. Quand vous l'avez, touchez le bouton vert : J'ai le colis." },
  RECUPEREE: { color: "#C2410C", soft: "#FFF7ED", emoji: "🚀", title: "Colis récupéré", next: { to: "EN_ROUTE", label: "Je pars livrer", emoji: "🛵" }, say: "Vous avez le colis. Appelez le client, puis touchez le bouton vert : Je pars livrer." },
  EN_ROUTE: { color: "#2563EB", soft: "#EFF6FF", emoji: "🛵", title: "En route vers le client", say: "Vous êtes en route. Chez le client, demandez son code à quatre chiffres, écrivez-le, puis touchez : Livraison terminée." },
};

const PROBLEMS = [
  { emoji: "📵", label: "Client injoignable" },
  { emoji: "🚪", label: "Client absent" },
  { emoji: "🗺️", label: "Adresse introuvable" },
  { emoji: "🙅", label: "Client refuse le colis" },
  { emoji: "💔", label: "Colis endommagé" },
];

/** Une course dans l'application Livreur : grandes images, gros boutons, une seule action principale, consigne à écouter. */
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
  const st = STEP[props.status] ?? STEP.ASSIGNEE!;
  const phone = props.customerPhone?.replace(/\D/g, "") ?? "";
  const hasPoint = props.lat != null && props.lng != null;

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

  const money = props.paid ? "Déjà payé, rien à encaisser." : `Encaissez ${props.total.toLocaleString("fr-FR")} francs.`;
  const say = `Course pour ${props.customerName}. ${props.place ?? props.address ?? ""}. ${money} ${st.say}`;

  return (
    <li id={`livraison-${props.id}`} className="scroll-mt-24 overflow-hidden rounded-3xl border-2 bg-white shadow-sm" style={{ borderColor: st.color }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-white" style={{ background: st.color }}>
        <span className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden="true" className="text-2xl">{st.emoji}</span>
          {st.title}
        </span>
        <ListenButton text={say} tone="dark" />
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="text-2xl font-extrabold text-ink">{props.customerName}</p>
          {props.forCustomer && <p className="text-base font-semibold text-amber-800">Pour le client de la vendeuse : {props.forCustomer}</p>}
          {props.orderedBy && <p className="text-base font-semibold text-navy/80">Commandé par {props.orderedBy}</p>}
          <p className="mt-1 text-lg text-navy/85">📍 {props.place ?? props.address ?? "Adresse non renseignée"}</p>
          {props.distanceKm != null && <p className="text-base text-navy/70">{props.distanceKm.toLocaleString("fr-FR")} km du dépôt</p>}
        </div>

        {props.approx && <p className="rounded-2xl bg-[#FEF3C7] px-4 py-3 text-base font-bold text-[#78350F]">📞 Adresse pas précise : appelez le client avant de partir.</p>}

        <div className="grid grid-cols-2 gap-2">
          {props.paid ? (
            <div className="rounded-2xl bg-[#DCFCE7] p-3 text-center text-[#14532D]"><span className="block text-3xl" aria-hidden="true">✅</span><span className="block text-base font-extrabold">Déjà payé</span><span className="block text-sm">rien à encaisser</span></div>
          ) : (
            <div className="rounded-2xl bg-[#FEF3C7] p-3 text-center text-[#78350F]"><span className="block text-3xl" aria-hidden="true">💵</span><span className="block text-sm font-bold">À encaisser</span><span className="block text-xl font-extrabold">{formatPrice(props.total)}</span></div>
          )}
          <div className="rounded-2xl bg-[#CCFBF1] p-3 text-center text-[#134E4A]"><span className="block text-3xl" aria-hidden="true">🪙</span><span className="block text-sm font-bold">Ma part</span><span className="block text-xl font-extrabold">{props.share > 0 ? formatPrice(props.share) : "—"}</span></div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Round href={hasPoint ? directionsUrl({ lat: props.lat!, lng: props.lng! }) : undefined} color="#1d2f4f" label="Maps" icon={<Navigation size={26} />} external />
          <Round href={hasPoint ? `https://waze.com/ul?ll=${props.lat},${props.lng}&navigate=yes` : undefined} color="#0E7490" label="Waze" icon={<span className="text-2xl" aria-hidden="true">🚙</span>} external />
          <Round href={phone ? `tel:+${phone}` : undefined} color="#15803D" label="Appeler" icon={<Phone size={26} />} />
          <Round href={phone ? `https://wa.me/${phone}` : undefined} color="#128C4B" label="WhatsApp" icon={<MessageCircle size={26} />} external />
        </div>

        {st.next && (
          <button type="button" disabled={pending} onClick={() => act(st.next!.to)} className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-[#15803D] text-2xl font-extrabold text-white shadow-lg disabled:opacity-60">
            {pending ? <Loader2 className="animate-spin" size={28} /> : <span aria-hidden="true">{st.next.emoji}</span>} {pending ? "Envoi…" : st.next.label}
          </button>
        )}

        {props.status === "EN_ROUTE" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("LIVREE", { code });
            }}
            className="space-y-3 rounded-2xl p-3"
            style={{ background: st.soft }}
          >
            <label htmlFor={`code-${props.id}`} className="block text-center text-lg font-extrabold text-ink">🔢 Code du client (4 chiffres)</label>
            <input id={`code-${props.id}`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="\d{4}" required placeholder="• • • •" autoComplete="one-time-code" className="block w-full rounded-2xl border-2 border-line bg-white px-3 py-4 text-center text-5xl font-extrabold tracking-[0.5em] text-ink outline-none focus:border-[#15803D]" />
            <button disabled={pending || code.length !== 4} className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-[#15803D] text-2xl font-extrabold text-white shadow-lg disabled:opacity-40">
              {pending ? <Loader2 className="animate-spin" size={28} /> : <span aria-hidden="true">🎉</span>} {pending ? "Vérification…" : "Livraison terminée"}
            </button>
          </form>
        )}

        {error && <p role="alert" className="rounded-2xl bg-[#FEE2E2] px-4 py-3 text-base font-bold text-[#7F1D1D]">✋ {error}</p>}

        {problem === null ? (
          <button type="button" onClick={() => setProblem("")} className="min-h-14 w-full rounded-2xl border-2 border-[#FCA5A5] text-base font-bold text-[#B91C1C]">⚠️ J&apos;ai un problème</button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-[#FEF2F2] p-3">
            <p className="text-center text-base font-extrabold text-[#7F1D1D]">Quel problème ?</p>
            <div className="grid grid-cols-2 gap-2">
              {PROBLEMS.map((p) => (
                <button key={p.label} type="button" aria-pressed={problem === p.label} onClick={() => setProblem(p.label)} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-sm font-bold ${problem === p.label ? "border-[#B91C1C] bg-[#B91C1C] text-white" : "border-[#FCA5A5] bg-white text-[#7F1D1D]"}`}>
                  <span className="text-3xl" aria-hidden="true">{p.emoji}</span>{p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending || !problem} onClick={() => act("ECHEC", { note: problem ?? "" })} className="min-h-14 flex-1 rounded-2xl bg-[#B91C1C] text-lg font-extrabold text-white disabled:opacity-40">Envoyer</button>
              <button type="button" onClick={() => setProblem(null)} className="min-h-14 rounded-2xl bg-white px-4 text-base font-bold text-navy">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Round({ href, color, label, icon, external }: { href?: string; color: string; label: string; icon: React.ReactNode; external?: boolean }) {
  const inner = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow" style={{ background: href ? color : "#9CA3AF" }}>{icon}</span>
      <span className="text-xs font-bold text-ink">{label}</span>
    </>
  );
  if (!href) return <span className="flex flex-col items-center gap-1 opacity-50" aria-disabled="true">{inner}</span>;
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="flex flex-col items-center gap-1">
      {inner}
    </a>
  );
}
